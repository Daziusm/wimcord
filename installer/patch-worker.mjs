#!/usr/bin/env node
/**
 * Runs install/repair/uninstall outside the Electron UI (avoids Discord file locks on Windows).
 */
import { spawn } from "child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { dirname, join } from "path";

import {
    ensureWimcordRootEnv,
    getInstallerAppDir,
    getInstallerPatchRequestPath,
    getInstallerResultPath,
    getInstallerSpawnCwd,
    isPackagedInstaller,
} from "./paths.mjs";

const INSTALLER_DIR = getInstallerAppDir();
const ROOT = ensureWimcordRootEnv();
const PATCH_REQUEST = getInstallerPatchRequestPath();
const RESULT_FILE = getInstallerResultPath();
const ENTRY = join(INSTALLER_DIR, "entry.mjs");

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

function respawnGui() {
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.WIMCORD_PATCH_WORKER;
    env.WIMCORD_INSTALLER_PACKAGED = "1";
    env.WIMCORD_INSTALLER_RESULT = "1";
    ensureWimcordRootEnv();

    // Packaged portable exe: relaunch with no args (entry.mjs path breaks portable startup).
    const args = isPackagedInstaller() ? [] : [ENTRY];

    const child = spawn(process.execPath, args, {
        cwd: getInstallerSpawnCwd(),
        env,
        detached: true,
        stdio: "ignore",
        windowsHide: false,
    });
    child.unref();
}

export async function runPatchWorker() {
    const request = readPatchRequest();
    if (!request) {
        console.error("[Wimcord] No patch request found.");
        return false;
    }

    const { runInstallerCliAsync } = await import("./wimcordInstallerLib.mjs");
    const { killDiscordProcesses } = await import("./discordKill.mjs");
    const { findDiscordUpdateExe } = await import("./utils.mjs");
    const { discordProcessName } = await import("./discordDetect.mjs");

    const target = request.target ?? { branch: "auto" };

    console.log(`\n[Wimcord] ${request.action} — closing UI freed Discord's files.\n`);

    const { ok: discordReady, log: killLog } = await killDiscordProcesses(target, chunk => process.stdout.write(chunk));
    if (killLog) process.stdout.write(killLog);
    if (!discordReady) {
        const errMsg = "Discord patch files are locked. Quit Discord and try again.";
        writeFileSync(
            RESULT_FILE,
            JSON.stringify({
                ok: false,
                error: errMsg,
                message: errMsg,
                log: killLog || errMsg,
                action: request.action,
                pending: false,
            })
        );
        respawnGui();
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

    respawnGui();
    return result.ok;
}

if (process.env.WIMCORD_PATCH_WORKER === "1") {
    runPatchWorker()
        .then(ok => process.exit(ok ? 0 : 1))
        .catch(err => {
            console.error("[Wimcord] Patch worker error:", err);
            process.exit(1);
        });
}
