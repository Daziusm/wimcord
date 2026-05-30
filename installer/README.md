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

## End users (GitHub release)

1. Download **`WimcordInstaller-<version>.exe`** (one file — no zip).
2. Double-click it, click **Install** in the window, restart Discord.

The exe unpacks Wimcord to `%LocalAppData%\Wimcord` on first run (you don’t manage folders yourself).

**Why not literally only an exe with zero hidden files?** Discord loads the mod from real files on disk (`dist/patcher.js`, etc.). The single exe embeds those files and extracts them once — same idea as other game installers.
