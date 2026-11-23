# Desktop restart

Adds a one-click **restart** control for the whole DeepSeek Harness **desktop app**, plus a
settings page to choose where the control appears.

## Where the button appears

A **Restart app** row inside the sidebar panel list’s **More** menu (the same menu that hosts
the panel list’s own actions). It matches the size and colour of the other rows' icons.

Open the plugin’s settings page (Settings → **Restart**) to hide or show this row and to
restart immediately.

## How the restart works

The plugin runs inside the desktop app’s host child process, so it cannot call Electron’s
`app.relaunch()` directly. When you confirm a restart it writes a small `restart-*.bat` helper to
`%TEMP%\dsh-desktop-restart\` and launches it through a **detached** `cmd.exe`. Detaching is essential: the main Electron
process keeps its children in a Windows job object, so a plain child would be killed together
with the app before it could relaunch it, whereas a detached `cmd.exe` breaks away and survives.
The helper waits briefly, then stops every `DeepSeek Harness` process (`taskkill` first, with a
PowerShell `Stop-Process` fallback for restricted tokens), waits, then clears the inherited
`ELECTRON_RUN_AS_NODE` flag and launches the executable from its install directory. Clearing that
flag is critical: the plugin runs inside the host child process, which was started with
`ELECTRON_RUN_AS_NODE=1`; if it is inherited, the relaunched exe runs as a plain Node process with
no window and exits immediately. Each step is appended to `restart.log` beside the helper so a
failed restart can be diagnosed. The window closes and reopens with a fresh app + host.

## Availability

Restart is only offered when the plugin runs inside the desktop app (`process.versions.electron`
is present). In a plain web or headless host the buttons are disabled and the settings page shows
a notice instead.

## Settings storage

Preferences are stored in `~/.dsh/desktop-restart-plugin.json` and apply immediately — no app
restart is needed to change where the button is shown.
