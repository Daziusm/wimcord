#!/usr/bin/env node
import { execFileSync } from "child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { Readable } from "stream";
import { finished } from "stream/promises";
import { fileURLToPath } from "url";

import { runPnpm } from "./spawnUtil.mjs";
import { patchInstallerBranding } from "./patch-installer-branding.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
const outDir = join(root, "release", `wimcord-installer-${version}`);
const bundleRoot = join(outDir, "wimcord");
const libDir = join(outDir, "lib");
const INSTALLER_URL =
    "https://github.com/Vencord/Installer/releases/download/v1.4.0/VencordInstaller.exe";

async function downloadInstaller(dest) {
    mkdirSync(dirname(dest), { recursive: true });
    const res = await fetch(INSTALLER_URL, { headers: { "User-Agent": "Wimcord" } });
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    const chunks = [];
    for await (const c of Readable.fromWeb(res.body)) chunks.push(c);
    const raw = Buffer.concat(chunks);
    const { buf, hits } = patchInstallerBranding(raw);
    if (hits === 0) console.warn("[Wimcord] GUI installer: no branding strings patched.");
    writeFileSync(dest, buf);
}

function writeReadme() {
    writeFileSync(
        join(outDir, "README.txt"),
        `Wimcord ${version} — Windows installer package

1. Extract this entire folder anywhere (e.g. Desktop\\Wimcord).
2. Double-click WimcordInstaller.exe
3. Click Install in the window, then restart Discord.

Your Wimcord files live in the "wimcord" subfolder next to the installer.
Do not delete that folder after installing.

https://github.com/Daziusm/wimcord
`.replace(/\n/g, "\r\n")
    );
}

console.log("[Wimcord] Building client…");
runPnpm(["run", "build"], { cwd: root });

if (!existsSync(join(root, "dist", "patcher.js"))) {
    console.error("[Wimcord] dist/patcher.js missing.");
    process.exit(1);
}

mkdirSync(outDir, { recursive: true });
mkdirSync(bundleRoot, { recursive: true });
mkdirSync(libDir, { recursive: true });
cpSync(join(root, "dist"), join(bundleRoot, "dist"), { recursive: true });

const guiDest = join(libDir, "WimcordInstaller.Gui.exe");
console.log("[Wimcord] Downloading & branding GUI installer…");
await downloadInstaller(guiDest);

const launcherDest = join(outDir, "WimcordInstaller.exe");
console.log("[Wimcord] Building WimcordInstaller.exe launcher…");
execFileSync(
    process.execPath,
    [join(root, "scripts", "build-wimcord-installer-launcher.mjs"), launcherDest],
    { stdio: "inherit", cwd: root }
);

writeReadme();

console.log(`\n[Wimcord] Ready: ${outDir}`);
console.log("  Double-click WimcordInstaller.exe (no .bat required)\n");
