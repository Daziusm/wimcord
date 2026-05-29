## Wimcord 0.1.3

**Installer stays open** while patching Discord. No more quit-and-reopen dance (that flow was unreliable).

### Install

1. Quit Discord from the **system tray**.
2. Run `Wimcord-Installer-0.1.3.exe`.
3. Pick Discord → **Install** → watch **Logs** for progress.
4. Restart Discord when it says done.

### Changes

- Portable installer patches **in-process** (same window, no background respawn).
- Dev `pnpm run wimcord:installer` still uses terminal handoff on Windows.
