#!/usr/bin/env node
/**
 * Wimcord CLI — thin wrapper over Vencord build/inject scripts
 */
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const commands = {
    build: ["pnpm", "run", "build"],
    dev: ["pnpm", "run", "dev"],
    inject: ["pnpm", "run", "inject"],
    "installer-gui": ["node", "scripts/wimcord-installer.mjs"],
    clean: null,
};

const cmd = process.argv[2];

if (!cmd || !(cmd in commands)) {
    console.log(`
Wimcord CLI

  node scripts/wimcord-cli.mjs <command>

Commands:
  build   Production build (Vencord esbuild pipeline)
  dev     Watch mode for development
  inject  Install into Discord desktop
  installer-gui  Open Wimcord installer window
  clean   Remove dist/ and build artifacts
`);
    process.exit(cmd ? 1 : 0);
}

if (cmd === "clean") {
    for (const dir of ["dist", "browser"]) {
        try {
            rmSync(resolve(root, dir), { recursive: true, force: true });
            console.log(`[wimcord] removed ${dir}/`);
        } catch {
            /* ignore */
        }
    }
    process.exit(0);
}

const [bin, ...args] = commands[cmd];
const result = spawnSync(bin, args, { cwd: root, stdio: "inherit", shell: true });
process.exit(result.status ?? 1);
