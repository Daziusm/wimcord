#!/usr/bin/env node
/**
 * Wimcord installer launcher — keeps Node alive, runs patches outside Electron.
 * Electron locks Discord's app.asar on Windows; the UI must exit before patching.
 */
import { spawn, spawnSync } from "child_process";
import { createRequire } from "module";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

import { installerTargetFromOptions } from "./wimcord-installer-job.mjs";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const main = join(root, "installer", "entry.mjs");
const uiDist = join(root, "installer", "ui", "dist", "index.html");
const PATCH_REQUEST = join(root, "dist", "installer-patch-request.json");
const RESULT_FILE = join(root, "dist", "installer-result.json");

if (!existsSync(uiDist)) {
    console.log("[Wimcord] Building installer UI…");
    const r = spawnSync(process.execPath, [join(root, "scripts", "build-installer-ui.mjs")], {
        cwd: root,
        stdio: "inherit",
    });
    if (r.status !== 0) process.exit(r.status ?? 1);
}

function resolveElectron() {
    try {
        const bin = require("electron");
        if (bin && existsSync(bin)) return bin;
    } catch {
        /* not installed */
    }
    const fallback =
        process.platform === "win32"
            ? join(root, "node_modules", "electron", "dist", "electron.exe")
            : join(root, "node_modules", "electron", "dist", "electron");
    return existsSync(fallback) ? fallback : null;
}

const electronBin = resolveElectron();
if (!electronBin) {
    console.error("[Wimcord] Electron not found. Run: pnpm install && node node_modules/electron/install.js");
    process.exit(1);
}

const guiEnv = (extra = {}) => ({
    ...process.env,
    VENCORD_USER_DATA_DIR: root,
    VENCORD_DEV_INSTALL: "1",
    WIMCORD_NODE: process.env.npm_node_execpath || process.env.WIMCORD_NODE || "",
    npm_node_execpath: process.env.npm_node_execpath || "",
    WIMCORD_INSTALLER_LAUNCHER: "1",
    ...extra,
});

function spawnGui(showResult = false) {
    return spawn(electronBin, [main], {
        cwd: root,
        stdio: "inherit",
        env: guiEnv(showResult ? { WIMCORD_INSTALLER_RESULT: "1" } : {}),
        shell: false,
    });
}

async function runPatchJob(request) {
    mkdirSync(join(root, "dist"), { recursive: true });

    const { runInstallerCliAsync } = await import("./wimcordInstallerLib.mjs");
    const { killDiscordProcesses } = await import("../installer/discordKill.mjs");
    const { findDiscordUpdateExe } = await import("../installer/utils.mjs");
    const { discordProcessName } = await import("../installer/discordDetect.mjs");

    const target = request.target ?? installerTargetFromOptions(request.options ?? {});

    console.log(`\n[Wimcord] ${request.action} — closing UI freed Discord's files. Progress below:\n`);

    const { ok: discordReady, log: killLog } = await killDiscordProcesses(target, chunk => process.stdout.write(chunk));
    if (killLog) process.stdout.write(killLog);
    if (!discordReady) {
        writeFileSync(
            RESULT_FILE,
            JSON.stringify({
                ok: false,
                error: "Discord patch files are locked. Quit Discord and try again.",
                log: killLog,
                action: request.action,
                pending: false,
            })
        );
        return false;
    }

    let log = "";
    const result = await runInstallerCliAsync(request.action, {
        target,
        onLog: chunk => {
            log += chunk;
            process.stdout.write(chunk);
        },
        onStatus: status => console.log(`[Wimcord] ${status}`),
    });

    const userMessage = result.ok
        ? request.action === "install"
            ? "Wimcord installed successfully"
            : request.action === "uninstall"
                ? "Wimcord uninstalled successfully"
                : request.action === "repair"
                    ? "Repair completed successfully"
                    : "Operation completed successfully"
        : result.error ?? `${request.action} failed`;

    writeFileSync(
        RESULT_FILE,
        JSON.stringify({
            ...result,
            log,
            action: request.action,
            message: userMessage,
            pending: false,
            finishedAt: Date.now(),
        })
    );

    if (result.ok) {
        console.log(`\n[Wimcord] ✔ ${userMessage}\n`);
    } else {
        console.error(`\n[Wimcord] ✖ ${userMessage}\n`);
    }

    if (
        result.ok &&
        request.options?.restartDiscord &&
        (request.action === "install" || request.action === "repair")
    ) {
        const found = findDiscordUpdateExe(target);
        if (found?.updateExe) {
            const processName = discordProcessName(found.install);
            spawn(found.updateExe, ["--processStart", processName], {
                detached: true,
                stdio: "ignore",
            }).unref();
            console.log(`[Wimcord] Started ${processName}`);
        }
    }

    return result.ok;
}

function readPatchRequest() {
    if (!existsSync(PATCH_REQUEST)) return null;
    try {
        const data = JSON.parse(readFileSync(PATCH_REQUEST, "utf-8"));
        unlinkSync(PATCH_REQUEST);
        return data;
    } catch {
        try {
            unlinkSync(PATCH_REQUEST);
        } catch { /* ignore */ }
        return null;
    }
}

async function mainLoop() {
    let showResult = false;

    while (true) {
        console.log("[Wimcord] Installer UI open — patch progress prints here when you Install/Uninstall.\n");
        const gui = spawnGui(showResult);
        showResult = false;

        const exitCode = await new Promise(resolve => {
            gui.on("error", err => {
                console.error("[Wimcord] Failed to start UI:", err.message);
                resolve(1);
            });
            gui.on("exit", code => resolve(code ?? 0));
        });

        const patchRequest = readPatchRequest();

        if (patchRequest && process.platform === "win32") {
            await runPatchJob(patchRequest);
            showResult = true;
            continue;
        }

        process.exit(exitCode);
    }
}

mainLoop().catch(err => {
    console.error("[Wimcord] Launcher error:", err);
    process.exit(1);
});
