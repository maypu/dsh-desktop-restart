# Desktop Restart · dsh-desktop-restart

[简体中文](README.md) | English

> A DSH plugin that adds a **one-click "restart the whole app"** entry to the **DeepSeek Harness desktop app**.

## Overview

The DeepSeek Harness desktop app has no built-in "restart application" button, so after changing settings or installing a new plugin you often have to close and reopen it manually.
This plugin adds a **Restart app** entry to the sidebar panel list's **More ⋯** menu — one click closes and relaunches the entire desktop app. It also ships a settings page to **show / hide** the entry and to restart immediately.

## Features

- **Sidebar "More" menu entry**: lives in the **More ⋯** menu at the top-right of the sidebar panel list; icon size and color match the host's native menu rows.
- **One-click full restart**: not just a page reload — it terminates the current process and relaunches `DeepSeek Harness.exe`.
- **Settings page**: under *Settings → Desktop restart*, toggle *Show in More menu* and use *Restart now*.
- **Persistent**: the toggle is stored in `~/.dsh/desktop-restart-plugin.json` and defaults to on.
- **Safe degradation**: on non-desktop environments (web / headless / non-Windows) the entry is hidden automatically.

## What it looks like

After installation, open the **More ⋯** menu of the sidebar panel list:

```
Sidebar panel list   ⋯ (More)
                     ├─ Customize entries
                     └─ Restart app        ← this plugin
```

*Settings → Desktop restart* contains:

- Switch: *Show in More menu*
- Button: *Restart now*

## Installation

This is a standard **DSH Bundle plugin**, installed into the DSH **desktop** plugin profile (`~/.dsh/profiles/desktop`).

### Option 1: Plugin marketplace (recommended)

Search for `dsh-desktop-restart` in the DSH plugin marketplace and install.

### Option 2: Install from a local directory

Put this repository on your machine, then run `plugin_manager`'s `install_bundle` with the **absolute path** of the repository, for example:

```
plugin_manager  action: install_bundle  target: <absolute path to this repo>
```

After installation, **restart the desktop app once** (or reload the plugin) to load the plugin's host half; then refresh the window to see the entry.
> Note: the plugin's **host half** (`index.js`) is loaded at app startup and is not hot-reloaded — restart/reload the plugin after changing it. The **UI half** (`client.js`) only needs a window refresh.

## Usage

- **Restart**: click **Restart app** in the sidebar **More ⋯** menu, then confirm; the app closes and relaunches automatically.
- **Toggle the entry**: go to *Settings → Desktop restart* and turn *Show in More menu* on or off.
- **Restart now**: use the *Restart now* button on the same settings page.

## Configuration

| Key | Location | Description | Default |
| --- | --- | --- | --- |
| `showInPanelMenu` | `~/.dsh/desktop-restart-plugin.json` | Whether to show *Restart app* in the sidebar More menu | `true` |

Example settings file:

```json
{
  "showInPanelMenu": true
}
```

> The file is written by the plugin and can be changed from the settings page; manual editing is usually unnecessary.

## How it works

1. Clicking **Restart app** calls the host route `POST /api/dsh-desktop-restart` (`action: "restart"`) via a same-origin request.
2. The host plugin (running inside the desktop app's host child process) writes a `.bat` helper into `%TEMP%\dsh-desktop-restart\`.
3. The helper is launched **detached** so it survives the app being killed:
   - `taskkill /F /IM "DeepSeek Harness.exe"` to stop the app;
   - `powershell Stop-Process` as a fallback for any remaining processes;
   - clear `ELECTRON_RUN_AS_NODE`, `cd` into the app directory, then `start "" "<app exe>"` to relaunch.
4. A log is written to `%TEMP%\dsh-desktop-restart\restart.log` for troubleshooting.

> Why clear `ELECTRON_RUN_AS_NODE`: the plugin host child process is started with `ELECTRON_RUN_AS_NODE=1`. If not cleared, the relaunched process would run as plain Node and exit immediately (with no window).

## Platform & compatibility

- **Platform**: **Windows** desktop only (uses `taskkill` / `Stop-Process` / `start`).
- **Environment**: requires the DSH desktop app (Electron). Web / headless environments hide the entry automatically.
- **Verified against**: DeepSeek Harness Desktop `0.2.2-rc.5` (Electron `44.x`, Node `24.x`).

## Repository layout

```
dsh-desktop-restart/
├─ package.json          # DSH bundle manifest (dsh.bundle / dsh.client / exports / files)
├─ cordis.patch.yml      # Patch inserted into the DSH plugin profile
├─ index.js              # Host plugin: /api/dsh-desktop-restart, settings I/O, restart helper
├─ client.js             # UI plugin: More-menu entry + settings page
├─ locale/
│  ├─ en.json            # English metadata
│  └─ zh.json            # Chinese metadata
├─ docs/
│  └─ DETAIL.md          # Plugin detail page (referenced by meta.detail)
├─ icon.svg              # Plugin icon
└─ LICENSE               # MIT
```

## Development

- No build step: `index.js` is an ES Module; `client.js` is a classic browser script registered through `window.__ModuleLoader__.load`.
- Syntax check:

```bash
node --check index.js
node --check client.js
```

- Debugging tips:
  - Editing `client.js` only needs a window refresh;
  - Editing `index.js` requires reloading the plugin / restarting the app (the host half is not hot-reloaded).

## Known limitations

- Windows desktop only.
- Restarting relies on system commands (`taskkill` / `powershell` / `start`), which may be denied under a restricted token or strict policy.
- The app briefly exits during a restart; make sure unsaved transient state is handled.

## License

[MIT](LICENSE) © 2026 maypu

## Disclaimer

This plugin terminates and relaunches the DeepSeek Harness desktop app process. Use it with that behavior in mind; the author is not liable for any data loss or damage caused by using this plugin.
