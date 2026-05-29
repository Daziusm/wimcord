/*
 * Wimcord — IPC to run inject/repair from the renderer installer UI
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IpcEvents } from "@shared/IpcEvents";
import { execFile } from "child_process";
import { ipcMain } from "electron";
import { join } from "path";
import { promisify } from "util";

import { WIMCORD_PUBLIC_RELEASE } from "../wimcord-core/publicRelease";

const execFileAsync = promisify(execFile);

export function initWimcordInstallerIpc() {
    if (WIMCORD_PUBLIC_RELEASE) return;

    ipcMain.handle(IpcEvents.WIMCORD_RUN_INSTALLER, async (_, action: "install" | "uninstall" | "repair") => {
        const root = process.env.VENCORD_USER_DATA_DIR ?? join(__dirname, "..");
        const installer = join(root, "scripts", "runInstaller.mjs");
        const installArgs =
            action === "uninstall" ? ["--", "--uninstall"] : ["--", "--install"];

        try {
            const { stdout, stderr } = await execFileAsync(process.execPath, [installer, ...installArgs], {
                cwd: root,
                env: {
                    ...process.env,
                    VENCORD_USER_DATA_DIR: root,
                    VENCORD_DEV_INSTALL: "1",
                },
                maxBuffer: 10 * 1024 * 1024,
            });
            return { ok: true as const, stdout, stderr };
        } catch (e: any) {
            return {
                ok: false as const,
                error: e?.message ?? String(e),
                stdout: e?.stdout?.toString?.() ?? "",
                stderr: e?.stderr?.toString?.() ?? "",
            };
        }
    });
}
