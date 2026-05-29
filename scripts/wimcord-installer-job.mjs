#!/usr/bin/env node
import { spawn } from "child_process";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { resolveNodeBinary } from "../installer/utils.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const JOB_FILE = join(ROOT, "dist", "installer-job.json");

/**
 * @param {string} action
 * @param {{ branch?: string, location?: string, restartDiscord?: boolean }} options
 */
export function installerTargetFromOptions(options = {}) {
    if (options?.location) return { location: options.location };
    if (options?.branch && options.branch !== "custom") return { branch: options.branch };
    return { branch: "auto" };
}

/**
 * Quit Electron and run patch job in plain Node (Electron locks Discord app.asar on Windows).
 */
export function startHeadlessInstallerJob(action, options = {}) {
    mkdirSync(dirname(JOB_FILE), { recursive: true });
    writeFileSync(
        JOB_FILE,
        JSON.stringify({
            action,
            target: installerTargetFromOptions(options),
            options,
        })
    );

    const node = resolveNodeBinary();
    const script = join(ROOT, "scripts", "wimcord-installer-headless.mjs");

    const child = spawn(node, [script], {
        cwd: ROOT,
        detached: true,
        stdio: "ignore",
        windowsHide: true,
        env: {
            ...process.env,
            VENCORD_USER_DATA_DIR: ROOT,
            VENCORD_DEV_INSTALL: "1",
            WIMCORD_NODE: node,
        },
    });
    child.unref();
    return true;
}
