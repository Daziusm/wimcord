#!/usr/bin/env node
/**
 * Append lib/ + wimcord/ zip payload to WimcordInstaller.exe (single-file release)
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { zipSync } from "fflate";

const MARKER = Buffer.from("WIMCORDPK1");

function addDir(base, prefix, files) {
    for (const name of readdirSync(base)) {
        const full = join(base, name);
        const rel = prefix ? `${prefix}/${name}` : name;
        if (statSync(full).isDirectory()) addDir(full, rel, files);
        else files[rel.replace(/\\/g, "/")] = readFileSync(full);
    }
}

const launcherExe = process.argv[2];
const libDir = process.argv[3];
const wimcordDir = process.argv[4];
const version = process.argv[5];
const outExe = process.argv[6];

if (!launcherExe || !libDir || !wimcordDir || !version || !outExe) {
    console.error("Usage: node append-installer-payload.mjs <launcher.exe> <libDir> <wimcordDir> <version> <out.exe>");
    process.exit(1);
}

const files = { "version.txt": Buffer.from(version, "utf8") };
addDir(libDir, "lib", files);
addDir(wimcordDir, "wimcord", files);

const zipped = zipSync(files, { level: 9 });
const launcher = readFileSync(launcherExe);
const len = Buffer.alloc(8);
len.writeBigUInt64LE(BigInt(zipped.length));

writeFileSync(outExe, Buffer.concat([launcher, MARKER, len, zipped]));
const mib = (launcher.length + zipped.length) / 1024 / 1024;
console.log(`[Wimcord] Single installer: ${outExe} (${mib.toFixed(2)} MiB)`);
