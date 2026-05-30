#!/usr/bin/env node
/**
 * Zip dist/ for GitHub release auto-update (wimcord-dist-{version}.zip)
 */
import { createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { zipSync } from "fflate";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
const distDir = join(root, "dist");
const outPath = join(root, "release", `wimcord-dist-${version}.zip`);

if (!existsSync(join(distDir, "patcher.js"))) {
    console.error("[Wimcord] Run pnpm build first — dist/patcher.js missing.");
    process.exit(1);
}

function addDir(base, prefix, files) {
    for (const name of readdirSync(base)) {
        const full = join(base, name);
        const rel = prefix ? `${prefix}/${name}` : name;
        if (statSync(full).isDirectory()) addDir(full, rel, files);
        else files[`dist/${rel}`] = readFileSync(full);
    }
}

const files = {};
addDir(distDir, "", files);

const zipped = zipSync(files, { level: 9 });
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, zipped);
console.log(`[Wimcord] Wrote ${outPath} (${(zipped.length / 1024 / 1024).toFixed(2)} MiB)`);
