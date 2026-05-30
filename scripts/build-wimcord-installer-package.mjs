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
const releaseDir = join(root, "release");
const singleExe = join(releaseDir, `WimcordInstaller-${version}.exe`);
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

console.log("[Wimcord] Building client…");
runPnpm(["run", "build"], { cwd: root });

if (!existsSync(join(root, "dist", "patcher.js"))) {
    console.error("[Wimcord] dist/patcher.js missing.");
    process.exit(1);
}

mkdirSync(outDir, { recursive: true });
mkdirSync(bundleRoot, { recursive: true });
mkdirSync(libDir, { recursive: true });
mkdirSync(releaseDir, { recursive: true });
cpSync(join(root, "dist"), join(bundleRoot, "dist"), { recursive: true });

const guiDest = join(libDir, "WimcordInstaller.Gui.exe");
console.log("[Wimcord] Downloading & branding GUI installer…");
await downloadInstaller(guiDest);

const launcherStub = join(outDir, ".launcher-stub.exe");
console.log("[Wimcord] Building launcher stub…");
execFileSync(
    process.execPath,
    [join(root, "scripts", "build-wimcord-installer-launcher.mjs"), launcherStub],
    { stdio: "inherit", cwd: root }
);

console.log("[Wimcord] Building single-file WimcordInstaller.exe…");
execFileSync(
    process.execPath,
    [
        join(root, "scripts", "append-installer-payload.mjs"),
        launcherStub,
        libDir,
        bundleRoot,
        version,
        singleExe,
    ],
    { stdio: "inherit", cwd: root }
);

// Optional folder layout for developers who prefer extracted files
cpSync(singleExe, join(outDir, "WimcordInstaller.exe"));

writeFileSync(
    join(outDir, "README.txt"),
    `Wimcord ${version}

Give users: WimcordInstaller-${version}.exe from the release folder (one file, no zip).

This folder is for development. Run WimcordInstaller.exe here OR use the standalone exe.

https://github.com/Daziusm/wimcord
`.replace(/\n/g, "\r\n")
);

console.log(`\n[Wimcord] Release installer (single file): ${singleExe}`);
console.log(`[Wimcord] Dev folder: ${outDir}\n`);
