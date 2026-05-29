#!/usr/bin/env node
/**
 * Run install/repair/uninstall outside Electron (Electron locks Discord's app.asar on Windows).
 */
import { spawn } from "child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { createRequire } from "module";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const JOB_FILE = join(ROOT, "dist", "installer-job.json");
const RESULT_FILE = join(ROOT, "dist", "installer-result.json");

function resolveElectron() {
    const require = createRequire(import.meta.url);
    try {
        const bin = require("electron");
        if (bin && existsSync(bin)) return bin;
    } catch { /* not installed */ }
    return process.platform === "win32"
        ? join(ROOT, "node_modules", "electron", "dist", "electron.exe")
        : join(ROOT, "node_modules", "electron", "dist", "electron");
}

function relaunchInstallerGui() {
    const electron = resolveElectron();
    if (!existsSync(electron)) {
        console.error("[Wimcord] Electron not found — reopen with: pnpm run wimcord:installer");
        return;
    }

    const main = join(ROOT, "installer", "main.mjs");
    const child = spawn(electron, [main], {
        cwd: ROOT,
        detached: true,
        stdio: "ignore",
        env: {
            ...process.env,
            VENCORD_USER_DATA_DIR: ROOT,
            VENCORD_DEV_INSTALL: "1",
            WIMCORD_INSTALLER_RESULT: "1",
        },
    });
    child.unref();
}

async function main() {
    if (!existsSync(JOB_FILE)) {
        console.error("[Wimcord] No installer job file:", JOB_FILE);
        process.exit(1);
    }

    const job = JSON.parse(readFileSync(JOB_FILE, "utf-8"));
    mkdirSync(dirname(RESULT_FILE), { recursive: true });

    const { runInstallerCliAsync } = await import("./wimcordInstallerLib.mjs");

    let log = "";
    const result = await runInstallerCliAsync(job.action, {
        target: job.target,
        onLog: chunk => {
            log += chunk;
            process.stdout.write(chunk);
        },
        onStatus: status => {
            writeFileSync(RESULT_FILE, JSON.stringify({ status, log, pending: true }));
        },
    });

    writeFileSync(
        RESULT_FILE,
        JSON.stringify({
            ...result,
            log,
            action: job.action,
            finishedAt: Date.now(),
            pending: false,
        })
    );

    if (result.ok && job.options?.restartDiscord && (job.action === "install" || job.action === "repair")) {
        const { findDiscordUpdateExe } = await import("../installer/utils.mjs");
        const { discordProcessName } = await import("../installer/discordDetect.mjs");
        const found = findDiscordUpdateExe(job.target);
        if (found?.updateExe) {
            const processName = discordProcessName(found.install);
            spawn(found.updateExe, ["--processStart", processName], {
                detached: true,
                stdio: "ignore",
            }).unref();
        }
    }

    relaunchInstallerGui();
    process.exit(result.ok ? 0 : 1);
}

main().catch(err => {
    writeFileSync(
        RESULT_FILE,
        JSON.stringify({
            ok: false,
            error: err?.message ?? String(err),
            log: "",
            pending: false,
        })
    );
    relaunchInstallerGui();
    process.exit(1);
});
