#!/usr/bin/env node
/**
 * Bundle Wimcord dist + official VencordInstaller.exe (GUI).
 * Output: release/wimcord-installer-<version>/ — extract and run "Install Wimcord.bat".
 * NOT published automatically — run locally after testing.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, createWriteStream } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { Readable } from "stream";
import { finished } from "stream/promises";

import { runPnpm } from "./spawnUtil.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
const outDir = join(root, "release", `wimcord-installer-${version}`);
const bundleRoot = join(outDir, "wimcord");
const VENCORD_GUI_URL =
    "https://github.com/Vencord/Installer/releases/download/v1.4.0/VencordInstaller.exe";

console.log("[Wimcord] Building client…");
runPnpm(["run", "build"], { cwd: root });

if (!existsSync(join(root, "dist", "patcher.js"))) {
    console.error("[Wimcord] dist/patcher.js missing after build.");
    process.exit(1);
}

mkdirSync(outDir, { recursive: true });
mkdirSync(bundleRoot, { recursive: true });

console.log("[Wimcord] Copying dist/ into bundle…");
cpSync(join(root, "dist"), join(bundleRoot, "dist"), { recursive: true });

console.log("[Wimcord] Downloading VencordInstaller.exe…");
const guiDest = join(outDir, "WimcordInstaller.exe");
const res = await fetch(VENCORD_GUI_URL, { headers: { "User-Agent": "Wimcord" } });
if (!res.ok) {
    console.error("[Wimcord] Download failed:", res.status);
    process.exit(1);
}
await finished(Readable.fromWeb(res.body).pipe(createWriteStream(guiDest)));

const bat = `@echo off
cd /d "%~dp0"
set "VENCORD_USER_DATA_DIR=%CD%\\wimcord"
set "WIMCORD_ROOT=%VENCORD_USER_DATA_DIR%"
set "VENCORD_DEV_INSTALL=1"
echo Wimcord ${version} — official Vencord Installer, Wimcord build bundled.
echo.
start "" "%~dp0WimcordInstaller.exe"
`;
writeFileSync(join(outDir, "Install Wimcord.bat"), bat.replace(/\n/g, "\r\n"));

writeFileSync(
    join(outDir, "README.txt"),
    `Wimcord ${version} — Windows install package

1. Quit Discord (system tray).
2. Double-click "Install Wimcord.bat" (not WimcordInstaller.exe alone).
3. In the installer window, pick Discord and install.
4. Restart Discord.

This uses Vencord's official VencordInstaller.exe with a bundled Wimcord build.
Do not run WimcordInstaller.exe directly — use the .bat so the correct files are used.
`
);

console.log(`
[Wimcord] Done (local test build — not a GitHub release).

  Folder: ${outDir}
  Run:    ${join(outDir, "Install Wimcord.bat")}

Zip that folder yourself if you want to share it.
`);
