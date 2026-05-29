## Wimcord 0.1.1

Fixes the Windows portable installer **flashing / not reopening** after Install.

### Install

Download **`Wimcord-Installer-0.1.1.exe`**, run from any folder (no setup wizard), pick Discord, Install, restart Discord when prompted.

### Changes

- Patch handoff files go to `%LOCALAPPDATA%\Wimcord\installer` (bundled resources are read-only).
- Installer relaunches correctly after patching (no broken `entry.mjs` respawn).
- Single-instance lock prevents multiple installer windows fighting each other.
