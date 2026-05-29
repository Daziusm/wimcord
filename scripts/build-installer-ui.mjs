#!/usr/bin/env node
import { existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { runPnpm } from "./spawnUtil.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const distIndex = join(root, "installer", "ui", "dist", "index.html");

if (existsSync(distIndex) && !process.argv.includes("--force")) {
    console.log("[Wimcord] Installer UI already built (use --force to rebuild)");
    process.exit(0);
}

runPnpm(["--filter", "wimcord-installer-ui", "build"], { cwd: root });
