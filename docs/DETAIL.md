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
`app.relaunch()` directly. When you confirm a restart it writes a small helper script into the
system temp dir (`dsh-desktop-restart/`) and launches it **detached** so it survives the app
being ended — a plain child would die together with the app before it could relaunch it.

- **Windows**: writes `restart-*.bat` and launches it through a detached `cmd.exe`. The main
  Electron process keeps its children in a Windows job object, so a plain child would be killed
  with the app; a detached `cmd.exe` breaks away. The helper stops every `DeepSeek Harness`
  process (`taskkill` first, with a PowerShell `Stop-Process` fallback), then clears the
  inherited `ELECTRON_RUN_AS_NODE` flag and `start`s the executable from its install directory.
- **macOS**: writes `restart-*.sh` and launches it through a detached `/bin/sh` (a new session,
  so it survives). The helper stops the app with `pkill -f "<app binary>"`, clears
  `ELECTRON_RUN_AS_NODE`, then reopens the surrounding `DeepSeek Harness.app` bundle with
  `open -n`.
- **Linux**: same detached `/bin/sh`; stops the app with `pkill -f`, clears
  `ELECTRON_RUN_AS_NODE`, then relaunches based on the packaging: Flatpak (`$FLATPAK_ID`) prefers
  `flatpak-spawn --host flatpak run <app-id>` and falls back to `flatpak run`; Snap (`$SNAP`) uses
  `snap run <name>`; AppImage uses `$APPIMAGE` (its mount path disappears on exit); otherwise the
  executable directly. Each branch falls back to a direct exec of the binary if the launcher is
  unavailable.

Clearing `ELECTRON_RUN_AS_NODE` is critical: the plugin runs inside the host child process,
which was started with `ELECTRON_RUN_AS_NODE=1`; if it is inherited, the relaunched binary runs
as a plain Node process with no window and exits immediately. Each step is appended to
`restart.log` beside the helper so a failed restart can be diagnosed. The window closes and
reopens with a fresh app + host.

## Availability

Restart is only offered when the plugin runs inside the desktop app (`process.versions.electron`
is present) on Windows, macOS or Linux. In a plain web or headless host the buttons are disabled
and the settings page shows a notice instead. When available, the settings page also prints the
launch target resolved for the current run (`kind · target`) to aid debugging.

## Settings storage

Preferences are stored in `~/.dsh/desktop-restart-plugin.json` and apply immediately — no app
restart is needed to change where the button is shown.
