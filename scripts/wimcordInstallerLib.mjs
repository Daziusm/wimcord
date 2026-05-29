/*
 * Wimcord — shared Vencord Installer CLI wrapper (official binary, Wimcord branding)
 */
import { execFileSync, spawn } from "child_process";
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync, openSync, closeSync } from "fs";
import { dirname, join } from "path";
import { Readable } from "stream";
import { finished } from "stream/promises";
import { fileURLToPath, pathToFileURL } from "url";

const BASE_URL = "https://github.com/Vencord/Installer/releases/latest/download/";
const INSTALLER_PATH_DARWIN = "VencordInstaller.app/Contents/MacOS/VencordInstaller";

const LIB_DIR = dirname(fileURLToPath(import.meta.url));
export const WIMCORD_ROOT =
    process.env.VENCORD_USER_DATA_DIR ??
    process.env.WIMCORD_ROOT ??
    join(LIB_DIR, "..");
function discordKillModule() {
    if (existsSync(join(LIB_DIR, "discordKill.mjs"))) {
        return join(LIB_DIR, "discordKill.mjs");
    }
    return join(LIB_DIR, "..", "installer", "discordKill.mjs");
}

const FILE_DIR = join(WIMCORD_ROOT, "dist", "Installer");
const ETAG_FILE = join(FILE_DIR, "etag.txt");
export const INSTALLER_LOG = join(WIMCORD_ROOT, "dist", "installer-last-run.log");

const TIMEOUT_MS = {
    uninstall: 3 * 60 * 1000,
    repair: 10 * 60 * 1000,
    install: 15 * 60 * 1000,
};

async function fetchWithTimeout(url, options = {}, ms = 30_000) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), ms);
    try {
        return await fetch(url, { ...options, signal: ac.signal });
    } finally {
        clearTimeout(t);
    }
}

export function getInstallerFilename() {
    switch (process.platform) {
        case "win32":
            return "VencordInstallerCli.exe";
        case "darwin":
            return "VencordInstaller.MacOS.zip";
        case "linux":
            return "VencordInstallerCli-linux";
        default:
            throw new Error("Unsupported platform: " + process.platform);
    }
}

export async function ensureInstallerBinary(onStatus) {
    const filename = getInstallerFilename();
    mkdirSync(FILE_DIR, { recursive: true });

    const outputFile = process.platform === "darwin"
        ? join(FILE_DIR, "VencordInstaller")
        : join(FILE_DIR, filename);

    if (existsSync(outputFile)) {
        onStatus?.("Checking for installer updates…");
        try {
            const etag = existsSync(ETAG_FILE) ? readFileSync(ETAG_FILE, "utf-8") : null;
            const res = await fetchWithTimeout(BASE_URL + filename, {
                headers: {
                    "User-Agent": "Wimcord",
                    "If-None-Match": etag ?? "",
                },
            });
            if (res.status === 304) {
                onStatus?.("Installer ready.");
                return outputFile;
            }
        } catch {
            onStatus?.("Using cached installer (update check failed).");
            return outputFile;
        }
    }

    onStatus?.("Downloading Vencord Installer CLI…");
    const res = await fetchWithTimeout(BASE_URL + filename, {
        headers: { "User-Agent": "Wimcord" },
    }, 120_000);

    if (!res.ok) {
        throw new Error(`Failed to download installer: ${res.status} ${res.statusText}`);
    }

    writeFileSync(ETAG_FILE, res.headers.get("etag") ?? "");

    if (process.platform === "darwin") {
        const zip = new Uint8Array(await res.arrayBuffer());
        const ff = await import("fflate");
        const bytes = ff.unzipSync(zip, {
            filter: f => f.name === INSTALLER_PATH_DARWIN,
        })[INSTALLER_PATH_DARWIN];
        writeFileSync(outputFile, bytes, { mode: 0o755 });
    } else {
        const body = Readable.fromWeb(res.body);
        await finished(body.pipe(createWriteStream(outputFile, { mode: 0o755, autoClose: true })));
    }

    onStatus?.("Installer downloaded.");
    return outputFile;
}

/**
 * @param {string} action
 * @param {{ branch?: string, location?: string } | null} [target]
 */
export function cliArgsForAction(action, target = null) {
    const args = cliArgsOnly(action);
    if (target?.location) {
        args.push("--location", target.location);
    } else if (target?.branch) {
        args.push("--branch", target.branch);
    } else {
        args.push("--branch", "auto");
    }
    return args;
}

function cliArgsOnly(action) {
    switch (action) {
        case "install":
            return ["--install"];
        case "repair":
            return ["--repair"];
        case "uninstall":
            return ["--uninstall"];
        default:
            throw new Error(`Unknown action: ${action}`);
    }
}

export function installerEnv(extra = {}) {
    return {
        ...process.env,
        VENCORD_USER_DATA_DIR: WIMCORD_ROOT,
        VENCORD_DEV_INSTALL: "1",
        ...extra,
    };
}

export function assertDevBuildExists() {
    const patcher = join(WIMCORD_ROOT, "dist", "patcher.js");
    if (!existsSync(patcher)) {
        throw new Error(
            "dist/ is missing. Click “Build latest (dev)” first, then Install."
        );
    }
}

export async function runInstallerCliSync(action, target = null) {
    if (action === "install" || action === "repair") assertDevBuildExists();
    const bin = await ensureInstallerBinary();
    const args = cliArgsForAction(action, target);
    console.log(`[Wimcord] Running ${bin} ${args.join(" ")}`);
    execFileSync(bin, args, {
        stdio: "inherit",
        env: installerEnv(),
        windowsHide: false,
    });
}

/**
 * @param {(line: string) => void} [onLog]
 * @param {(msg: string) => void} [onStatus]
 */
function spawnInstallerOnce(bin, args, timeout, onLog) {
    return new Promise(resolve => {
        const logFd = openSync(INSTALLER_LOG, "a");

        const child = spawn(bin, args, {
            cwd: WIMCORD_ROOT,
            shell: false,
            windowsHide: false,
            env: installerEnv(),
            stdio: ["ignore", logFd, logFd],
        });

        closeSync(logFd);

        let logOffset = 0;
        const pollLog = setInterval(() => {
            try {
                const full = readFileSync(INSTALLER_LOG, "utf-8");
                if (full.length > logOffset) {
                    const chunk = full.slice(logOffset);
                    logOffset = full.length;
                    onLog?.(chunk);
                }
            } catch { /* ignore */ }
        }, 400);

        const timer = setTimeout(() => {
            onLog?.("\n[Wimcord] Timed out — killing installer.\n");
            try {
                child.kill("SIGTERM");
                setTimeout(() => child.kill("SIGKILL"), 3000);
            } catch { /* ignore */ }
        }, timeout);

        const finish = result => {
            clearInterval(pollLog);
            clearTimeout(timer);
            try {
                const tail = readFileSync(INSTALLER_LOG, "utf-8").slice(logOffset);
                if (tail) onLog?.(tail);
            } catch { /* ignore */ }
            resolve(result);
        };

        child.on("error", err => {
            let log = "";
            try { log = readFileSync(INSTALLER_LOG, "utf-8"); } catch { /* ignore */ }
            finish({ ok: false, stdout: log, stderr: "", error: err.message });
        });

        child.on("close", code => {
            let log = "";
            try { log = readFileSync(INSTALLER_LOG, "utf-8"); } catch { /* ignore */ }
            finish({
                ok: code === 0,
                stdout: log,
                stderr: "",
                error: code === 0 ? undefined : `Installer exited with code ${code}`,
            });
        });
    });
}

export function runInstallerCliAsync(action, { onLog, onStatus, target = null } = {}) {
    const timeout = TIMEOUT_MS[action] ?? 10 * 60 * 1000;
    const maxAttempts = 3;

    return new Promise(async resolve => {
        try {
            if (action === "install" || action === "repair") assertDevBuildExists();

            onStatus?.("Preparing installer…");
            const bin = await ensureInstallerBinary(onStatus);
            const args = cliArgsForAction(action, target);

            mkdirSync(dirname(INSTALLER_LOG), { recursive: true });

            const { killDiscordProcesses, isSharingViolationLog } = await import(
                pathToFileURL(discordKillModule()).href
            );

            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                if (attempt > 1) {
                    onLog?.(`\n[Wimcord] Retry ${attempt}/${maxAttempts} after file lock…\n`);
                }

                writeFileSync(INSTALLER_LOG, `[Wimcord] ${bin} ${args.join(" ")}\n`);

                if (process.platform === "win32" && (action === "install" || action === "repair" || action === "uninstall")) {
                    onStatus?.("Closing Discord and checking patch files…");
                    const { ok } = await killDiscordProcesses(target, chunk => onLog?.(chunk));
                    if (!ok) {
                        resolve({
                            ok: false,
                            stdout: readFileSync(INSTALLER_LOG, "utf-8"),
                            stderr: "",
                            error: "Discord patch files are locked. See log window for details.",
                        });
                        return;
                    }
                }

                onStatus?.(
                    action === "install"
                        ? "Installing… (console may open)"
                        : `Running ${action}…`
                );
                onLog?.(`> ${bin} ${args.join(" ")}\n`);

                const result = await spawnInstallerOnce(bin, args, timeout, onLog);

                if (result.ok) {
                    resolve(result);
                    return;
                }

                const logText = result.stdout ?? "";
                if (!isSharingViolationLog(logText) || attempt === maxAttempts) {
                    resolve(result);
                    return;
                }

                onLog?.("\n[Wimcord] Installer reported files in use — killing processes and retrying…\n");
                await new Promise(r => setTimeout(r, 2000));
            }
        } catch (e) {
            resolve({
                ok: false,
                stdout: "",
                stderr: "",
                error: e?.message ?? String(e),
            });
        }
    });
}
