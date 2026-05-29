#!/usr/bin/env node
/**
 * Launch Vencord's official GUI installer (VencordInstaller.exe) for Wimcord.
 * No custom Electron UI — same tool Vencord ships, with VENCORD_USER_DATA_DIR → this repo.
 */
import { spawn } from "child_process";
import { existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { ensureInstallerBinary, installerEnv } from "./wimcordInstallerLib.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

if (!existsSync(join(root, "dist", "patcher.js"))) {
    console.error("[Wimcord] dist/patcher.js missing. Run: pnpm run build");
    process.exit(1);
}

const VENCORD_GUI = "VencordInstaller.exe";
const BASE_URL = "https://github.com/Vencord/Installer/releases/download/v1.4.0/";

async function ensureVencordGuiInstaller() {
    const { mkdirSync, writeFileSync, readFileSync, createWriteStream } = await import("fs");
    const { finished } = await import("stream/promises");
    const { Readable } = await import("stream");

    const dir = join(root, "dist", "Installer");
    mkdirSync(dir, { recursive: true });
    const out = join(dir, VENCORD_GUI);

    if (existsSync(out)) return out;

    console.log("[Wimcord] Downloading VencordInstaller.exe (official GUI)…");
    const res = await fetch(BASE_URL + VENCORD_GUI, { headers: { "User-Agent": "Wimcord" } });
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    const body = Readable.fromWeb(res.body);
    await finished(body.pipe(createWriteStream(out)));
    console.log("[Wimcord] Saved:", out);
    return out;
}

const guiPath = await ensureVencordGuiInstaller();
console.log(`[Wimcord] Opening Vencord Installer → patching with build at ${root}\n`);

const child = spawn(guiPath, [], {
    cwd: dirname(guiPath),
    env: installerEnv({ WIMCORD_ROOT: root }),
    stdio: "inherit",
    windowsHide: false,
});

child.on("error", err => {
    console.error("[Wimcord] Failed to start installer:", err.message);
    process.exit(1);
});

child.on("exit", code => process.exit(code ?? 0));
