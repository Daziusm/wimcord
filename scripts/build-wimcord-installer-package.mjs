#!/usr/bin/env node
import { cpSync, createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { finished } from "stream/promises";
import { Readable } from "stream";
import { fileURLToPath } from "url";

import { runPnpm } from "./spawnUtil.mjs";
import { patchInstallerBranding } from "./patch-installer-branding.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
const outDir = join(root, "release", `wimcord-installer-${version}`);
const bundleRoot = join(outDir, "wimcord");
const INSTALLER_URL =
    "https://github.com/Vencord/Installer/releases/download/v1.4.0/VencordInstaller.exe";

async function downloadInstaller(dest) {
    mkdirSync(dirname(dest), { recursive: true });
    const res = await fetch(INSTALLER_URL, { headers: { "User-Agent": "Wimcord" } });
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    const chunks = [];
    for await (const c of Readable.fromWeb(res.body)) chunks.push(c);
    const raw = Buffer.concat(chunks);
    const { buf } = patchInstallerBranding(raw);
    writeFileSync(dest, buf);
}

console.log("[Wimcord] Building client…");
runPnpm(["run", "build"], { cwd: root });

if (!existsSync(join(root, "dist", "patcher.js"))) {
    console.error("[Wimcord] dist/patcher.js missing.");
    process.exit(1);
}

mkdirSync(outDir, { recursive: true });
mkdirSync(bundleRoot, { recursive: true });
cpSync(join(root, "dist"), join(bundleRoot, "dist"), { recursive: true });

const exeDest = join(outDir, "WimcordInstaller.exe");
console.log("[Wimcord] Downloading WimcordInstaller.exe…");
await downloadInstaller(exeDest);

writeFileSync(
    join(outDir, "Install Wimcord.bat"),
    `@echo off
cd /d "%~dp0"
set "VENCORD_USER_DATA_DIR=%CD%\\wimcord"
set "VENCORD_DEV_INSTALL=1"
start "" "%~dp0WimcordInstaller.exe"
`.replace(/\n/g, "\r\n")
);

console.log(`\n[Wimcord] ${outDir}\n  Run Install Wimcord.bat\n`);
