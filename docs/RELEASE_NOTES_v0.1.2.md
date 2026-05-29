## Wimcord 0.1.2

Fixes **"Discord patch files are locked"** when Discord is already closed.

### Changes

- Patch worker now starts **3 seconds after** the installer UI exits (the UI was keeping `app.asar` locked).
- Stronger Discord shutdown (all `Discord*` processes, longer wait, clearer logs).
- Release installer no longer shows false **"Build not complete"** warning.

### Before installing

1. Quit Discord from the **system tray** (not just the window).
2. Optional: **Manage → Close Discord** in the installer.
3. Run **Install** again.
