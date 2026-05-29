# Installer

`WimcordInstaller.exe` is the official [Vencord Installer](https://github.com/Vencord/Installer) binary, renamed. Same app, same patch logic.

```bash
pnpm run build
pnpm run wimcord:installer
```

The launcher sets `VENCORD_USER_DATA_DIR` to this repo so installs use your Wimcord build.

Offline folder: `pnpm run wimcord:installer:package`
