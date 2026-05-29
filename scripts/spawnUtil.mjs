/**
 * Cross-platform spawn helpers (Windows paths with spaces, .cmd shims).
 */
import { execFileSync, spawnSync } from "child_process";
import { existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function quoteWin(arg) {
    const s = String(arg);
    if (!/[\s"]/u.test(s)) return s;
    return `"${s.replace(/"/g, '\\"')}"`;
}

/** Run a .cmd / pnpm / global tool on Windows via one properly quoted shell line. */
function runWindowsShellLine(commandLine, opts = {}) {
    const r = spawnSync(commandLine, {
        cwd: opts.cwd ?? root,
        stdio: "inherit",
        shell: true,
        windowsHide: true,
        env: { ...process.env, ...opts.env },
    });
    if (r.error) {
        console.error("[Wimcord]", r.error.message);
        process.exit(1);
    }
    if (r.status !== 0) {
        process.exit(r.status ?? 1);
    }
}

/** Run node, electron-builder, or other real executables (no shell). */
export function runExec(bin, args, opts = {}) {
    const r = spawnSync(bin, args, {
        cwd: opts.cwd ?? root,
        stdio: "inherit",
        shell: false,
        windowsHide: true,
        env: { ...process.env, ...opts.env },
    });
    if (r.error) {
        console.error(`[Wimcord] Failed to run ${bin}:`, r.error.message);
        process.exit(1);
    }
    if (r.status !== 0) {
        process.exit(r.status ?? 1);
    }
}

export function runExecFile(bin, args, opts = {}) {
    try {
        execFileSync(bin, args, {
            cwd: opts.cwd ?? root,
            stdio: "inherit",
            windowsHide: true,
            env: { ...process.env, ...opts.env },
        });
    } catch (e) {
        console.error(`[Wimcord] Command failed:`, e.message ?? e);
        process.exit(e.status ?? 1);
    }
}

export function resolvePnpm() {
    const local = join(root, "node_modules", ".bin", process.platform === "win32" ? "pnpm.cmd" : "pnpm");
    if (existsSync(local)) return local;

    if (process.platform === "win32") {
        try {
            const out = execFileSync("where.exe", ["pnpm"], { encoding: "utf8", windowsHide: true });
            const lines = out.trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean);
            const preferred = lines.find(l => /\.cmd$/i.test(l)) ?? lines[0];
            if (preferred && existsSync(preferred)) return preferred;
        } catch { /* ignore */ }
        return "pnpm.cmd";
    }

    return "pnpm";
}

/** Run pnpm with args — safe when pnpm lives under paths with spaces. */
export function runPnpm(args, opts = {}) {
    const pnpm = resolvePnpm();
    if (process.platform === "win32") {
        const line = [quoteWin(pnpm), ...args.map(quoteWin)].join(" ");
        runWindowsShellLine(line, opts);
        return;
    }
    runExec(pnpm, args, opts);
}
