#!/usr/bin/env node
/**
 * Build Wimcord + installer UI, bundle Vencord CLI, produce a single portable Windows .exe.
 */
import { copyFileSync, existsSync, readFileSync } from "fs";
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

const version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
const outRelative = `../release/installer-${version}`;
const outDir = join(root, "release", `installer-${version}`);
const exePath = join(outDir, `Wimcord-Installer-${version}.exe`);

console.log(`[Wimcord] Packaging Windows installer (electron-builder → ${outRelative})…`);
console.log("[Wimcord] Tip: close any running Wimcord Installer window if a build fails with “file in use”.\n");
runExecFile(
    process.execPath,
    [eb, "--win", "--config", "electron-builder.yml", `--config.directories.output=${outRelative}`],
    { cwd: installerDir }
);

console.log(`\n[Wimcord] Done. Run:\n  ${exePath}\n`);
