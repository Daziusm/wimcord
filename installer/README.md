# Wimcord Installer

Uses the official [Vencord Installer](https://github.com/Vencord/Installer) under the hood. UI strings and Windows binaries are rebranded to **Wimcord** (`WimcordInstaller.exe`, `WimcordInstallerCli.exe`).

## Developers (this repo)

```bash
pnpm run build
pnpm run wimcord:installer
```

Opens the branded GUI and installs from your local `dist/` folder.

CLI (no window):

```bash
pnpm run inject
pnpm run repair
pnpm run uninject
```

## End users (release zip)

1. Extract `wimcord-installer-<version>/` anywhere.
2. Double-click **`WimcordInstaller.exe`** at the top level (not a `.bat`).
3. Click **Install** in the window, then restart Discord.

Layout:

```
wimcord-installer-0.1.5/
  WimcordInstaller.exe       ← launcher you run
  lib/WimcordInstaller.Gui.exe
  wimcord/dist/              ← mod files
  README.txt
```

Your install data stays in the `wimcord/` folder next to the installer.
