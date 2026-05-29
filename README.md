# Wimcord

**Stable, customizable Discord — built on [Vencord](https://github.com/Vendicated/Vencord).**

Wimcord is a desktop client mod with a focused first-party layer on top of the full Vencord plugin library: performance tooling, optional UI polish, crash diagnostics, update checks, and a lightweight badge registry. No account middleman — it patches your local Discord install like Vencord does.

[![Release](https://img.shields.io/github/v/release/Daziusm/wimcord?label=download&style=for-the-badge)](https://github.com/Daziusm/wimcord/releases/latest)
[![License](https://img.shields.io/badge/license-GPL--3.0--or--later-blue?style=for-the-badge)](LICENSE)
[![Discord](https://img.shields.io/badge/Discord-desktop%20only-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.com/download)

---

## Install (Windows)

Uses **[Vencord’s official installer](https://github.com/Vencord/Installer)** (`VencordInstaller.exe`) with your Wimcord build bundled — not a custom Electron wrapper.

**From source (dev):**

```bash
pnpm install
pnpm run build
pnpm run wimcord:installer
```

Quit Discord from the system tray first. Pick your Discord install in the Vencord installer window and install.

**Offline package (local build, for testing):**

```bash
pnpm run wimcord:installer:package
```

Then run **`Install Wimcord.bat`** inside `release/wimcord-installer-<version>/` (always use the `.bat`, not `WimcordInstaller.exe` alone).

Older GitHub releases shipped an experimental Electron installer; prefer the flow above until a new release is tested.

---

## What you get

| | |
|---|---|
| **Vencord ecosystem** | Hundreds of upstream plugins, themes, and settings you already know. |
| **Wimcord Panel** | User Settings → **Wimcord** — feature toggles, badges, updates, diagnostics. |
| **Performance monitor** | Optional FPS / memory overlay (on by default). |
| **UI tweak pack** | Minimal polish plugins, gated off until you enable them. |
| **Crash diagnostics** | Optional local logs and heartbeats to debug restarts — nothing uploaded unless you share files yourself. |
| **Wimcord badges** | Optional registry; only your **Discord user id** is sent if you opt in — never your token. |
| **Installer** | Official Vencord GUI installer, pointed at the Wimcord build. |

---

## After install

Open **User Settings → Plugins** for Vencord plugins, and **User Settings → Wimcord** for Wimcord-specific options.

**Privacy:** see [Security policy](docs/SECURITY.md).

---

## Build from source

Requirements: [Node.js](https://nodejs.org/) 20+, [pnpm](https://pnpm.io/), Git.

```bash
git clone https://github.com/Daziusm/wimcord.git
cd wimcord
pnpm install
pnpm run build
pnpm run wimcord:installer
```

CLI alternative (no GUI):

```bash
pnpm run build
pnpm run inject
```

**Package for offline testing:**

```bash
pnpm run wimcord:installer:package
```

Output: `release/wimcord-installer-<version>/` — run `Install Wimcord.bat` inside it.

---

## Project layout

| Path | What it is |
|------|------------|
| `src/wimcord-core/` | Branding, config, badges, diagnostics, public-release flags |
| `src/wimcord-plugins/` | First-party plugins (panel, updater, perf, badges, …) |
| `src/plugins/` | Upstream Vencord plugins |
| `src/userplugins/` | Local-only plugins (gitignored) |
| `installer/` | Portable Windows installer (Electron + Vencord CLI) |
| `docs/` | Security, contributing, badge API, examples |

---

## Badge server (self-hosters)

Public registry format and API overview: [`docs/wimcord-badge-server.md`](docs/wimcord-badge-server.md).  
Example manifest: [`docs/examples/wimcord-badges.example.json`](docs/examples/wimcord-badges.example.json).

Admin keys live **only** on your server (`WIMCORD_BADGE_ADMIN_KEY`), never in this repo.

---

## Documentation

| Doc | |
|-----|---|
| [Security](docs/SECURITY.md) | Privacy, tokens, diagnostics |
| [Contributing](docs/CONTRIBUTING.md) | Development setup |
| [Code of conduct](docs/CODE_OF_CONDUCT.md) | Community standards |
| [Badge server API](docs/wimcord-badge-server.md) | Registry format (self-hosters) |

## Contributing & issues

Bug reports and feature requests: [GitHub Issues](https://github.com/Daziusm/wimcord/issues).  
Do not post tokens or full diagnostic dumps in public tickets.

---

## License

[GPL-3.0-or-later](LICENSE) — inherited from [Vencord](https://github.com/Vendicated/Vencord).  
Discord is a trademark of Discord Inc. This project is not affiliated with Discord or Vencord.
