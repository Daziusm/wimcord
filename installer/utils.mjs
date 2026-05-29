import { execFileSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";

import { discordUpdateExe, findDiscordInstalls, parseDiscordInstall } from "./discordDetect.mjs";
import { getWimcordRoot } from "./paths.mjs";

const ROOT = getWimcordRoot();

let cachedNode = null;
let cachedPnpm = null;

/**
 * Resolve Node.js — never use Electron's process.execPath for child scripts.
 */
export function resolveNodeBinary() {
    if (cachedNode && existsSync(cachedNode)) return cachedNode;

    const candidates = [
        process.env.WIMCORD_NODE,
        process.env.npm_node_execpath,
        process.env.NODE_EXE,
        process.env.NODE,
    ].filter(Boolean);

    for (const c of candidates) {
        if (existsSync(c)) {
            cachedNode = c;
            return c;
        }
    }

    if (!process.versions?.electron && existsSync(process.execPath)) {
        cachedNode = process.execPath;
        return cachedNode;
    }

    try {
        const cmd = process.platform === "win32" ? "where.exe" : "which";
        const out = execFileSync(cmd, ["node"], {
            encoding: "utf8",
            windowsHide: true,
            env: process.env,
        });
        const first = out.trim().split(/\r?\n/)[0]?.trim();
        if (first && existsSync(first)) {
            cachedNode = first;
            return cachedNode;
        }
    } catch { /* ignore */ }

    throw new Error(
        "Node.js not found. Run the installer from a terminal: pnpm run wimcord:installer"
    );
}

/** pnpm in repo — avoids Windows opening .js files with Script Host */
export function resolvePnpmBinary() {
    if (cachedPnpm && existsSync(cachedPnpm)) return cachedPnpm;

    const binDir = join(ROOT, "node_modules", ".bin");
    const names = process.platform === "win32"
        ? ["pnpm.cmd", "pnpm.CMD", "pnpm"]
        : ["pnpm"];

    for (const name of names) {
        const p = join(binDir, name);
        if (existsSync(p)) {
            cachedPnpm = p;
            return cachedPnpm;
        }
    }

    try {
        const cmd = process.platform === "win32" ? "where.exe" : "which";
        const out = execFileSync(cmd, ["pnpm"], {
            encoding: "utf8",
            windowsHide: true,
            env: process.env,
        });
        const lines = out.trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const preferred = lines.find(l => l.toLowerCase().endsWith(".cmd")) ?? lines[0];
        if (preferred && existsSync(preferred)) {
            cachedPnpm = preferred;
            return cachedPnpm;
        }
    } catch { /* ignore */ }

    throw new Error("pnpm not found in PATH. Install pnpm or run: corepack enable");
}

/**
 * @param {{ branch?: string, location?: string } | null} [target]
 */
export function findDiscordUpdateExe(target = null) {
    if (target?.location) {
        const parsed = parseDiscordInstall(target.location);
        if (parsed) {
            const updateExe = discordUpdateExe(parsed);
            if (updateExe) return { updateExe, install: parsed };
        }
        const updateExe = join(target.location, "Update.exe");
        if (existsSync(updateExe)) {
            return {
                updateExe,
                install: {
                    branch: "custom",
                    path: target.location,
                    version: "",
                    patched: false,
                    label: "Custom",
                },
            };
        }
        return null;
    }

    const installs = findDiscordInstalls();
    if (!installs.length) return null;

    if (target?.branch) {
        const match = installs.find(i => i.branch === target.branch);
        if (match) {
            const updateExe = discordUpdateExe(match);
            if (updateExe) return { updateExe, install: match };
        }
        return null;
    }

    const first = installs[0];
    const updateExe = discordUpdateExe(first);
    if (updateExe) return { updateExe, install: first };
    return null;
}
