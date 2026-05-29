import { execFileSync } from "child_process";
import { existsSync, renameSync } from "fs";
import { join } from "path";

import { getLatestResourcesDir } from "./discordDetect.mjs";
import { findDiscordUpdateExe } from "./utils.mjs";

const DISCORD_IMAGES = [
    "Discord.exe",
    "DiscordPTB.exe",
    "DiscordCanary.exe",
    "DiscordDevelopment.exe",
    "DiscordCrashHandler.exe",
    "DiscordCrashHandler64.exe",
];

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

export function forceKillDiscordSync() {
    let log = "";

    for (const name of DISCORD_IMAGES) {
        try {
            execFileSync("taskkill", ["/F", "/IM", name], { windowsHide: true, stdio: "ignore" });
            log += `taskkill /F /IM ${name}\n`;
        } catch { /* not running */ }
        try {
            execFileSync("taskkill", ["/F", "/T", "/IM", name], { windowsHide: true, stdio: "ignore" });
        } catch { /* not running */ }
    }

    try {
        execFileSync("taskkill", ["/F", "/IM", "VencordInstallerCli.exe"], { windowsHide: true, stdio: "ignore" });
        log += "taskkill /F /IM VencordInstallerCli.exe\n";
    } catch { /* none */ }

    return log;
}

/**
 * Kill any process whose executable lives under the Discord install folder.
 * @param {string} installPath
 */
function killProcessesUnderInstallPath(installPath) {
    if (!installPath) return "";

    const escaped = installPath.replace(/'/g, "''");
    const script = `
$dir = '${escaped}'
Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
  Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($dir, [System.StringComparison]::OrdinalIgnoreCase) } |
  ForEach-Object {
    Write-Output "Stopping $($_.Name) (PID $($_.ProcessId))"
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  }
`;
    try {
        return execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], {
            encoding: "utf8",
            windowsHide: true,
            timeout: 20000,
        }).trim();
    } catch {
        return "";
    }
}

/**
 * List processes that might hold Discord's app.asar (for logs).
 * @param {string | null} installPath
 */
export function listDiscordRelatedProcesses(installPath) {
    const pathFilter = installPath
        ? `$_.ExecutablePath -like '*${installPath.replace(/\\/g, "\\\\")}*' -or `
        : "";
    const script = `
@(
  Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object { ${pathFilter}$_.Name -like 'Discord*' }
) | Select-Object -Unique Name, ProcessId, ExecutablePath | ConvertTo-Json -Compress
`;
    try {
        const out = execFileSync("powershell", ["-NoProfile", "-Command", script], {
            encoding: "utf8",
            windowsHide: true,
            timeout: 10000,
        }).trim();
        if (!out) return [];
        const parsed = JSON.parse(out);
        return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
        return [];
    }
}

/**
 * Same rename the Vencord installer does — if this fails, the CLI will fail too.
 * @param {string | null} installPath
 */
export function canRenamePatchFiles(installPath) {
    if (!installPath) return { ok: true };

    const resources = getLatestResourcesDir(installPath);
    if (!resources) return { ok: true };

    const appAsar = join(resources, "app.asar");
    const testTmp = join(resources, ".wimcord-rename-test.tmp");

    if (!existsSync(appAsar)) return { ok: true, reason: "no-app-asar" };

    try {
        if (existsSync(testTmp)) {
            try {
                renameSync(testTmp, appAsar);
            } catch { /* leave */ }
        }
        renameSync(appAsar, testTmp);
        renameSync(testTmp, appAsar);
        return { ok: true };
    } catch (e) {
        const code = /** @type {NodeJS.ErrnoException} */ (e).code ?? "UNKNOWN";
        return { ok: false, code, file: appAsar };
    }
}

/**
 * @param {string | null} installPath
 */
async function waitUntilPatchable(installPath, onLog) {
    for (let i = 0; i < 12; i++) {
        const check = canRenamePatchFiles(installPath);
        if (check.ok) return { ok: true };

        if (i === 0 || i % 3 === 0) {
            onLog?.(`[Wimcord] app.asar still locked (${check.code}) — waiting…\n`);
            const procs = listDiscordRelatedProcesses(installPath);
            for (const p of procs.slice(0, 8)) {
                onLog?.(`  • ${p.Name} (PID ${p.ProcessId}) ${p.ExecutablePath ?? ""}\n`);
            }
        }

        forceKillDiscordSync();
        if (installPath) {
            const stopped = killProcessesUnderInstallPath(installPath);
            if (stopped) onLog?.(`${stopped}\n`);
        }
        await sleep(1500);
    }

    return { ok: false };
}

/**
 * @param {{ branch?: string, location?: string } | null} target
 * @param {(chunk: string) => void} [onLog]
 */
export async function killDiscordProcesses(target = null, onLog) {
    if (process.platform !== "win32") {
        return { log: "", ok: true };
    }

    const found = findDiscordUpdateExe(target);
    const installPath = found?.install?.path ?? null;

    let log = forceKillDiscordSync();
    if (installPath) {
        const extra = killProcessesUnderInstallPath(installPath);
        if (extra) log += `${extra}\n`;
    }

    onLog?.(log);

    const ready = await waitUntilPatchable(installPath, onLog);
    if (ready.ok) {
        onLog?.("[Wimcord] app.asar is writable — safe to run installer\n");
        return { log, ok: true };
    }

    const tail = `
[Wimcord] Discord patch files are still locked.

• Quit Discord (system tray)
• Close this installer — the Electron window itself can lock Discord on Windows; patching runs in a separate process
• Task Manager → end Discord* tasks, then try again
`;
    onLog?.(tail);
    return { log: log + tail, ok: false };
}

export function isSharingViolationLog(text) {
    return /used by a different process|ERROR_SHARING_VIOLATION|sharing violation/i.test(text);
}
