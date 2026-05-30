#!/usr/bin/env node
/**
 * Branded Vencord Installer GUI (WimcordInstaller.exe) for local dev builds.
 */
import { spawn } from "child_process";
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { finished } from "stream/promises";
import { Readable } from "stream";
import { fileURLToPath } from "url";

import { installerEnv } from "./wimcordInstallerLib.mjs";
import { installerNeedsBrandingPatch, patchInstallerBranding } from "./patch-installer-branding.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const GUI_DIR = join(root, "dist", "Installer");
const WIMCORD_INSTALLER = join(GUI_DIR, "WimcordInstaller.exe");
const UPSTREAM_CACHE = join(GUI_DIR, ".vencord-upstream.exe");
const VENCORD_INSTALLER_URL =
    "https://github.com/Vencord/Installer/releases/download/v1.4.0/VencordInstaller.exe";

async function downloadUpstream() {
    const res = await fetch(VENCORD_INSTALLER_URL, { headers: { "User-Agent": "Wimcord" } });
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    await finished(Readable.fromWeb(res.body).pipe(createWriteStream(UPSTREAM_CACHE)));
}

async function ensureWimcordInstaller() {
    mkdirSync(GUI_DIR, { recursive: true });

    if (existsSync(WIMCORD_INSTALLER)) {
        const existing = readFileSync(WIMCORD_INSTALLER);
        if (!installerNeedsBrandingPatch(existing)) {
            return WIMCORD_INSTALLER;
        }
        console.log("[Wimcord] Patching installer UI (Vencord → Wimcord)…");
    } else {
        console.log("[Wimcord] Downloading installer…");
    }

    if (!existsSync(UPSTREAM_CACHE)) {
        await downloadUpstream();
    }

    const { buf, hits } = patchInstallerBranding(readFileSync(UPSTREAM_CACHE));
    if (hits === 0) {
        console.warn("[Wimcord] No strings patched — delete dist/Installer and retry.");
    }
    writeFileSync(WIMCORD_INSTALLER, buf);
    console.log("[Wimcord] Saved:", WIMCORD_INSTALLER);
    return WIMCORD_INSTALLER;
}

if (!existsSync(join(root, "dist", "patcher.js"))) {
    console.error("[Wimcord] dist/patcher.js missing. Run: pnpm run build");
    process.exit(1);
}

const guiPath = await ensureWimcordInstaller();
console.log(`[Wimcord] Opening Wimcord Installer → ${root}\n`);

const child = spawn(guiPath, [], {
    cwd: GUI_DIR,
    env: installerEnv({ WIMCORD_ROOT: root }),
    stdio: "inherit",
    windowsHide: false,
});

child.on("error", err => {
    console.error("[Wimcord] Failed to start installer:", err.message);
    process.exit(1);
});

child.on("exit", code => process.exit(code ?? 0));
