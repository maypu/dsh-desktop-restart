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
// a small helper script plus a log file and launch it *detached* so it survives the
// app being ended.
//
// - Windows: a `.bat` helper launched through a detached cmd.exe. The main Electron
//   process keeps its children in a Windows job object, so a plain child would be
//   killed together with the app; a detached cmd.exe breaks away (verified).
// - macOS / Linux: a `.sh` helper launched through a detached `/bin/sh`. On POSIX
//   `detached: true` makes the child a new session leader (setsid), so it keeps
//   running after the app process is gone.
//
// The helper waits briefly, stops every harness process (Windows: taskkill first,
// then a PowerShell Stop-Process fallback; POSIX: pkill -f <exe>, then pkill -9),
// waits, clears the inherited ELECTRON_RUN_AS_NODE flag, then launches the app
// again (Windows: start; macOS: `open -n` on the .app bundle; Linux: Flatpak via
// `flatpak run`, Snap via `snap run`, AppImage via $APPIMAGE, otherwise the
// executable). Each step is appended to a log for diagnosis.

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
  const supported =
    process.platform === 'win32' || process.platform === 'darwin' || process.platform === 'linux'
  if (!supported) {
    return { available: false, reason: 'unsupported-platform', exeName: null, platform: process.platform }
  }
  const exe = process.execPath
  const exeName = String(exe).split(/[\\/]/).pop() || String(exe)
  return { available: true, reason: null, exeName, platform: process.platform, exePath: exe }
}

function publicInfo() {
  const launch = resolveLaunch()
  if (!launch.available) {
    return { available: false, reason: launch.reason, exeName: null, platform: launch.platform, launch: null }
  }
  return {
    available: true,
    reason: null,
    exeName: launch.exeName,
    platform: launch.platform,
    // Surface the resolved relaunch target so the settings page can show it for debugging.
    launch: { kind: launch.kind, target: launch.target, exePath: launch.exePath },
  }
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

// ---- POSIX (macOS / Linux) helpers -----------------------------------------

function shQuote(value) {
  // POSIX single-quote: wrap in '...', escaping embedded ' as '\''
  return "'" + String(value).replace(/'/g, "'\\''") + "'"
}

function posixDirname(p) {
  const s = String(p)
  const i = s.lastIndexOf('/')
  if (i < 0) return '.'
  if (i === 0) return '/'
  return s.slice(0, i)
}

// Walk up from an executable path to the nearest *.app bundle, so we relaunch the
// app bundle (via `open`) instead of the bare binary inside Contents/MacOS.
export function macAppBundle(exePath) {
  const parts = String(exePath).split('/')
  for (let i = parts.length - 1; i >= 0; i--) {
    if (/\.app$/i.test(parts[i])) return parts.slice(0, i + 1).join('/') || '/'
  }
  return null
}

// Resolve how the app should be relaunched on this platform.
//  - win32:  the executable itself
//  - darwin: the surrounding .app bundle when present, else the executable
//  - linux:  in priority order Flatpak ($FLATPAK_ID), Snap ($SNAP_NAME/$SNAP),
//            AppImage ($APPIMAGE, whose mount path vanishes on exit), else the
//            executable
export function resolveLaunch() {
  const info = desktopInfo()
  if (!info.available) return info
  if (info.platform === 'darwin') {
    const bundle = macAppBundle(info.exePath)
    if (bundle) return Object.assign({}, info, { kind: 'mac-app', target: bundle })
    return Object.assign({}, info, { kind: 'exe', target: info.exePath })
  }
  if (info.platform === 'linux') {
    const flatpakId = process.env.FLATPAK_ID
    if (flatpakId) return Object.assign({}, info, { kind: 'flatpak', target: flatpakId })
    const snapName = process.env.SNAP_INSTANCE_NAME || process.env.SNAP_NAME
    if (snapName && process.env.SNAP) return Object.assign({}, info, { kind: 'snap', target: snapName })
    const appimage = process.env.APPIMAGE
    if (appimage) return Object.assign({}, info, { kind: 'appimage', target: appimage })
    return Object.assign({}, info, { kind: 'exe', target: info.exePath })
  }
  return Object.assign({}, info, { kind: 'exe', target: info.exePath })
}

export function buildPosixRestartScript(launch) {
  const platform = launch.platform
  const kind = launch.kind
  const exePath = launch.exePath
  const target = launch.target
  const logPath = join(tmpdir(), 'dsh-desktop-restart', 'restart.log')
  const lines = [
    '#!/bin/sh',
    '# dsh-desktop-restart helper (' + platform + ', ' + kind + ')',
    'LOG=' + shQuote(logPath),
    "log() { echo \"[$(date '+%Y-%m-%d %H:%M:%S')] $*\" >> \"$LOG\"; }",
    'log ' + shQuote('helper start platform=' + platform + ' kind=' + kind),
    'sleep 1',
    'log ' + shQuote('stopping ' + exePath),
    'pkill -f ' + shQuote(exePath) + ' >> "$LOG" 2>&1',
    'log "pkill TERM done"',
    'sleep 1',
    'pkill -9 -f ' + shQuote(exePath) + ' >> "$LOG" 2>&1',
    'log "pkill KILL done"',
    'sleep 1',
    // CRITICAL: same ELECTRON_RUN_AS_NODE issue as on Windows -- the host child
    // was started with it set, and a relaunched binary would run headless.
    'unset ELECTRON_RUN_AS_NODE',
  ]
  if (kind === 'mac-app') {
    lines.push(
      'log ' + shQuote('open -n ' + target),
      'open -n ' + shQuote(target) + ' >> "$LOG" 2>&1',
      'log "open issued code=$?"',
    )
  } else if (kind === 'flatpak') {
    // Inside a Flatpak sandbox the reliable way out is flatpak-spawn --host;
    // fall back to `flatpak run` and finally to a direct exec of the binary.
    lines.push(
      'log ' + shQuote('flatpak run ' + target),
      'if command -v flatpak-spawn >/dev/null 2>&1; then',
      '  flatpak-spawn --host flatpak run ' + shQuote(target) + ' >> "$LOG" 2>&1 &',
      '  log "flatpak-spawn relaunch issued code=$?"',
      'elif command -v flatpak >/dev/null 2>&1; then',
      '  flatpak run ' + shQuote(target) + ' >> "$LOG" 2>&1 &',
      '  log "flatpak run code=$?"',
      'else',
      '  log "no flatpak launcher; direct exec fallback"',
      '  cd ' + shQuote(posixDirname(exePath)) + ' >/dev/null 2>&1 || true',
      '  nohup ' + shQuote(exePath) + ' >> "$LOG" 2>&1 &',
      '  log "relaunch issued code=$?"',
      'fi',
    )
  } else if (kind === 'snap') {
    // Snaps keep their revision mounted, so a direct exec of the binary is a
    // usable fallback when `snap run` is not reachable from inside confinement.
    lines.push(
      'log ' + shQuote('snap run ' + target),
      'if command -v snap >/dev/null 2>&1; then',
      '  snap run ' + shQuote(target) + ' >> "$LOG" 2>&1 &',
      '  log "snap run code=$?"',
      'else',
      '  log "no snap launcher; direct exec fallback"',
      '  cd ' + shQuote(posixDirname(exePath)) + ' >/dev/null 2>&1 || true',
      '  nohup ' + shQuote(exePath) + ' >> "$LOG" 2>&1 &',
      '  log "relaunch issued code=$?"',
      'fi',
    )
  } else {
    lines.push(
      'unset ELECTRON_NO_ATTACH_CONSOLE',
      'cd ' + shQuote(posixDirname(target)) + ' >/dev/null 2>&1 || true',
      'nohup ' + shQuote(target) + ' >> "$LOG" 2>&1 &',
      'log "relaunch issued code=$?"',
    )
  }
  lines.push('sleep 5', 'pgrep -f ' + shQuote(exePath) + ' >> "$LOG" 2>&1', 'log "post-check done"')
  return lines.join('\n')
}

function launchHelper(helperPath) {
  // Detached so it breaks away from the parent app and survives it being killed.
  // No inherited handles; unref so we never wait on it.
  if (process.platform === 'win32') {
    const child = spawn('cmd.exe', ['/c', helperPath], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    })
    child.on('error', () => {})
    child.unref()
    return
  }
  const child = spawn('/bin/sh', [helperPath], {
    detached: true,
    stdio: 'ignore',
  })
  child.on('error', () => {})
  child.unref()
}

async function scheduleRestart() {
  const launch = resolveLaunch()
  if (!launch.available) throw new Error('desktop-unavailable')
  const dir = join(tmpdir(), 'dsh-desktop-restart')
  await mkdir(dir, { recursive: true })
  const stamp = Date.now() + '-' + Math.random().toString(36).slice(2, 8)
  if (launch.platform === 'win32') {
    const helper = join(dir, 'restart-' + stamp + '.bat')
    await writeFile(helper, buildRestartScript(launch.exePath), 'utf8')
    launchHelper(helper)
  } else {
    const helper = join(dir, 'restart-' + stamp + '.sh')
    await writeFile(helper, buildPosixRestartScript(launch), { encoding: 'utf8', mode: 0o755 })
    launchHelper(helper)
  }
  return true
}

function json(body, status) {
  return Response.json(body, {
    status: status || 200,
    headers: { 'Cache-Control': 'no-store' },
  })
}

const BUILD_TAG = 'cross-platform-v5-packaging'

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
