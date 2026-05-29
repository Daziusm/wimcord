#!/usr/bin/env node
/**
 * Build Wimcord + installer UI, bundle Vencord CLI, produce a single portable Windows .exe.
 */
import { copyFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { runExecFile, runPnpm } from "./spawnUtil.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

console.log("[Wimcord] Building client (dist/)…");
runPnpm(["run", "build"], { cwd: root });

if (!existsSync(join(root, "dist", "patcher.js"))) {
    console.error("[Wimcord] dist/patcher.js missing after build.");
    process.exit(1);
}

console.log("[Wimcord] Downloading Vencord Installer CLI…");
const { ensureInstallerBinary } = await import("./wimcordInstallerLib.mjs");
await ensureInstallerBinary(msg => console.log(`[Wimcord] ${msg}`));

console.log("[Wimcord] Building installer UI…");
runExecFile(process.execPath, [join(root, "scripts", "build-installer-ui.mjs"), "--force"], { cwd: root });

// Same folder as discordKill.mjs inside the packaged app
copyFileSync(
    join(root, "scripts", "wimcordInstallerLib.mjs"),
    join(root, "installer", "wimcordInstallerLib.mjs")
);

const installerDir = join(root, "installer");
const eb = join(installerDir, "node_modules", "electron-builder", "cli.js");
if (!existsSync(eb)) {
    console.log("[Wimcord] Installing installer packager dependencies…");
    runPnpm(["install"], { cwd: root });
}

console.log("[Wimcord] Packaging Windows installer (electron-builder)…");
runExecFile(process.execPath, [eb, "--win", "--config", "electron-builder.yml"], { cwd: installerDir });

console.log("\n[Wimcord] Done. Output: release/installer/\n");
