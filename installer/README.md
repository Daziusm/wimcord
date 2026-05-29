# Wimcord Installer

Electron GUI that patches Discord using the official [Vencord Installer CLI](https://github.com/Vencord/Installer).

## Dev mode

From the repo root:

```bash
pnpm install
pnpm run wimcord:installer:setup
pnpm run wimcord:installer:build-ui
pnpm run wimcord:installer
```

Requires Node.js and pnpm. You must **Build** before **Install**.

## Release `.exe`

```bash
pnpm run wimcord:installer:exe
```

This command:

1. Builds Wimcord (`dist/`)
2. Downloads `VencordInstallerCli.exe`
3. Builds the installer UI
4. Runs `electron-builder` (single portable `.exe`)

Output: `release/installer/Wimcord-Installer-<version>.exe`

### Safe testing (important)

- **Close Cursor (or VS Code) before running the built installer** if you test install/patch — the installer only kills `Discord.exe` / PTB / Canary, not generic Electron apps, but patching still restarts processes.
- **Do not** run broad `taskkill` on `electron.exe` — that will close Cursor, Slack, VS Code, etc.
- If a previous build left `release/installer/win-unpacked` locked, close any **Wimcord Installer** window, then delete that folder manually before rebuilding (do not kill all Electron processes).
