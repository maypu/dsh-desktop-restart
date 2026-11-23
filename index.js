import { spawn } from 'node:child_process'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'

// Host half of the DSH desktop-restart plugin.
//
// It exposes a single connection-fenced JSON route that the client half uses to
// (a) read/update where the restart button is shown and (b) request a restart.
//
// The restart itself must leave the Electron process tree: the plugin runs inside
// the `dsh-desktop-host` child process, so it cannot call app.relaunch(). We write
// a small .bat helper plus a log file, and launch it through a *detached* cmd.exe.
//
// Why detached cmd (and not a plain child, and not powershell): the main Electron
// process puts its children in a Windows job object, so a plain (un-detached) child
// is killed together with the app when the app processes are force-stopped — it
// dies mid-script and never reaches Start-Process. A detached cmd.exe breaks away
// from that job (verified) and survives the app being killed; a batch file (unlike
// DETACHED_PROCESS powershell, which has no console and exits immediately) runs
// fine detached. The helper kills every harness process (taskkill first, then a
// PowerShell Stop-Process fallback for restrictive tokens), waits, then launches
// the exe again. Each step is appended to a log for diagnosis.

export const inject = ['connection']

const ROUTE = '/api/dsh-desktop-restart'
const STATE_DIR = join(homedir(), '.dsh')
const SETTINGS_FILE = join(STATE_DIR, 'desktop-restart-plugin.json')
const DEFAULTS = { showInSidebarFooter: true, showInPanelMenu: true }

function normalize(raw) {
  const o = raw && typeof raw === 'object' ? raw : {}
  return {
    showInSidebarFooter: o.showInSidebarFooter !== false,
    showInPanelMenu: o.showInPanelMenu !== false,
  }
}

async function readSettings() {
  try {
    const text = await readFile(SETTINGS_FILE, 'utf8')
    return normalize(JSON.parse(text))
  } catch {
    return { ...DEFAULTS }
  }
}

async function writeSettings(settings) {
  await mkdir(STATE_DIR, { recursive: true })
  await writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8')
  return settings
}

function desktopInfo() {
  const isElectron = Boolean(process.versions && process.versions.electron)
  if (!isElectron) {
    return { available: false, reason: 'not-desktop', exeName: null, platform: process.platform }
  }
  if (process.platform !== 'win32') {
    return { available: false, reason: 'unsupported-platform', exeName: null, platform: process.platform }
  }
  const exe = process.execPath
  const exeName = String(exe).split(/[\\/]/).pop() || String(exe)
  return { available: true, reason: null, exeName, platform: process.platform, exePath: exe }
}

function publicInfo() {
  const info = desktopInfo()
  return { available: info.available, reason: info.reason, exeName: info.exeName, platform: info.platform }
}

function psSingleQuote(value) {
  return "'" + String(value).replace(/'/g, "''") + "'"
}

export function buildRestartScript(exePath) {
  const exe = String(exePath)
  return [
    '@echo off',
    'setlocal enableextensions',
    'set "EXE=' + exe + '"',
    'set "LOG=%~dp0restart.log"',
    'for %%F in ("%EXE%") do set "IMG=%%~nxF"',
    'for %%F in ("%EXE%") do set "PROC=%%~nF"',
    'for %%F in ("%EXE%") do set "APPDIR=%%~dpF"',
    'echo [%DATE% %TIME%] helper start img=%IMG% proc=%PROC%>>"%LOG%"',
    // Give the click's HTTP response time to flush before the app dies.
    'ping -n 2 127.0.0.1 >nul',
    'taskkill /F /IM "%IMG%" >>"%LOG%" 2>&1',
    'echo [%DATE% %TIME%] taskkill done>>"%LOG%"',
    // Fallback for restricted tokens where taskkill is denied.
    'powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Process -Name \'%PROC%\' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue" >>"%LOG%" 2>&1',
    'echo [%DATE% %TIME%] stop-process done>>"%LOG%"',
    'ping -n 3 127.0.0.1 >nul',
    // CRITICAL: this helper (and thus the launched exe) inherits the host child's
    // environment, which sets ELECTRON_RUN_AS_NODE=1. If left set, the relaunched
    // exe starts as a plain Node process with no window and exits. Clear it, and
    // also start from the install directory so relative resources resolve.
    'set "ELECTRON_RUN_AS_NODE="',
    'cd /d "%APPDIR%"',
    'echo [%DATE% %TIME%] launching from %APPDIR%>>"%LOG%"',
    'start "" "%EXE%"',
    'echo [%DATE% %TIME%] relaunch issued errorlevel=%ERRORLEVEL%>>"%LOG%"',
    // Post-check: record whether the app process is up a few seconds later.
    'ping -n 7 127.0.0.1 >nul',
    'tasklist /FI "IMAGENAME eq %IMG%" >>"%LOG%" 2>&1',
    'echo [%DATE% %TIME%] post-check done>>"%LOG%"',
    'endlocal',
  ].join('\r\n')
}

function launchHelper(helperPath) {
  // Detached so it breaks away from the main process' job object and survives the
  // app being force-killed. No inherited handles; unref so we never wait on it.
  const child = spawn('cmd.exe', ['/c', helperPath], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  })
  child.on('error', () => {})
  child.unref()
}

async function scheduleRestart() {
  const info = desktopInfo()
  if (!info.available) throw new Error('desktop-unavailable')
  const dir = join(tmpdir(), 'dsh-desktop-restart')
  await mkdir(dir, { recursive: true })
  const stamp = Date.now() + '-' + Math.random().toString(36).slice(2, 8)
  const helper = join(dir, 'restart-' + stamp + '.bat')
  await writeFile(helper, buildRestartScript(info.exePath), 'utf8')
  launchHelper(helper)
  return true
}

function json(body, status) {
  return Response.json(body, {
    status: status || 200,
    headers: { 'Cache-Control': 'no-store' },
  })
}

const BUILD_TAG = 'detached-bat-v3-envfix'

export async function apply(ctx) {
  // Best-effort startup marker so we can confirm which build the running host
  // actually loaded (host modules are only re-imported on plugin/app reload).
  try {
    await mkdir(STATE_DIR, { recursive: true })
    await writeFile(
      join(STATE_DIR, 'desktop-restart-plugin.started'),
      new Date().toISOString() + ' ' + BUILD_TAG + '\n',
      'utf8',
    )
  } catch {
    /* ignore */
  }
  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: ROUTE,
        methods: ['GET', 'POST'],
        requestBody: 'buffered',
        async fetch(request) {
          const method = String(request.method || 'GET').toUpperCase()
          if (method === 'GET') {
            const settings = await readSettings()
            return json({ ok: true, settings, ...publicInfo() })
          }

          let payload = null
          try {
            payload = await request.json()
          } catch {
            return json({ ok: false, error: 'bad-json' }, 400)
          }
          const action = payload && payload.action

          if (action === 'getSettings') {
            const settings = await readSettings()
            return json({ ok: true, settings, ...publicInfo() })
          }
          if (action === 'setSettings') {
            const saved = await writeSettings(normalize(payload.settings))
            return json({ ok: true, settings: saved })
          }
          if (action === 'restart') {
            if (!desktopInfo().available) return json({ ok: false, error: 'not-desktop' }, 409)
            try {
              await scheduleRestart()
              return json({ ok: true, scheduled: true })
            } catch (err) {
              return json({ ok: false, error: 'restart-failed', message: String((err && err.message) || err) }, 500)
            }
          }
          return json({ ok: false, error: 'unknown-action' }, 400)
        },
      }),
    'desktop-restart: fetch route',
  )
}
