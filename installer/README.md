# Wimcord install (Windows)

## Recommended: Vencord’s official installer

```bash
# from repo root
pnpm run build
pnpm run wimcord:installer
```

Opens **`VencordInstaller.exe`** with `VENCORD_USER_DATA_DIR` set to this repo so it patches Discord with Wimcord’s `dist/`.

Offline folder for testers:

```bash
pnpm run wimcord:installer:package
```

Output: `release/wimcord-installer-<version>/`  
Run **`Install Wimcord.bat`** (sets env vars, then starts the GUI).

## CLI only

```bash
pnpm run build
pnpm run wimcord:installer:cli
```

## Deprecated: custom Electron installer

`wimcord:installer:electron` / `wimcord:installer:electron:exe` — experimental UI that conflicted with Discord file locks. Do not ship to users until reworked.
