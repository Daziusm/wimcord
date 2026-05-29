#!/usr/bin/env node
/**
 * Wimcord Installer GUI
 */
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { spawn } from "child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { join } from "path";

import { findDiscordInstalls, parseDiscordInstall, discordProcessName } from "./discordDetect.mjs";
import { killDiscordProcesses } from "./discordKill.mjs";
import { findDiscordUpdateExe, resolvePnpmBinary } from "./utils.mjs";
import {
    ensureWimcordRootEnv,
    getInstallerAppDir,
    getInstallerPatchRequestPath,
    getInstallerResultPath,
    getInstallerSpawnCwd,
    getWimcordRoot,
    isPackagedInstaller,
} from "./paths.mjs";
import { ensureInstallerBinary, runInstallerCliAsync } from "./wimcordInstallerLib.mjs";

const __dirname = getInstallerAppDir();
const ROOT = ensureWimcordRootEnv();
const PATCH_REQUEST = getInstallerPatchRequestPath();
const RESULT_FILE = getInstallerResultPath();
const ENTRY = join(__dirname, "entry.mjs");

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
    app.quit();
}

let mainWindow = null;
let logWindow = null;
let logBuffer = "";

function appendLog(text) {
    if (!text) return;
    logBuffer += text;
    if (logWindow && !logWindow.isDestroyed()) {
        logWindow.webContents.send("log-append", text);
    }
}

function ensureLogWindow() {
    if (logWindow && !logWindow.isDestroyed()) {
        logWindow.focus();
        return;
    }

    logWindow = new BrowserWindow({
        width: 680,
        height: 420,
        minWidth: 480,
        minHeight: 280,
        title: "Wimcord — Logs",
        backgroundColor: "#09090b",
        autoHideMenuBar: true,
        parent: mainWindow ?? undefined,
        webPreferences: {
            preload: join(__dirname, "log-preload.cjs"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
    });

    logWindow.loadFile(join(__dirname, "log.html"));
    logWindow.on("closed", () => {
        logWindow = null;
    });
    logWindow.webContents.on("did-finish-load", () => {
        if (logBuffer) logWindow.webContents.send("log-append", logBuffer);
    });
}

function clearLogBuffer() {
    logBuffer = "";
    if (logWindow && !logWindow.isDestroyed()) {
        logWindow.webContents.send("log-clear");
    }
}

function sendProgress(data) {
    mainWindow?.webContents?.send("wimcord-installer-progress", data);
    if (data.log) {
        ensureLogWindow();
        appendLog(data.log);
    }
}

function runCommand(bin, args, { label = "command", cwd = ROOT, shell = false } = {}) {
    return new Promise(resolve => {
        const child = spawn(bin, args, {
            cwd,
            shell,
            windowsHide: true,
            env: {
                ...process.env,
                VENCORD_USER_DATA_DIR: ROOT,
                VENCORD_DEV_INSTALL: "1",
            },
        });

        let stdout = "";
        let stderr = "";

        child.stdout?.on("data", d => { stdout += d.toString(); });
        child.stderr?.on("data", d => { stderr += d.toString(); });

        child.on("error", err => {
            resolve({
                ok: false,
                error: `${label} failed to start: ${err.message}`,
                stdout,
                stderr,
            });
        });

        child.on("close", code => {
            resolve({
                ok: code === 0,
                stdout,
                stderr,
                error: code === 0 ? undefined : `${label} exited with code ${code}`,
            });
        });
    });
}

function installerTarget(options) {
    if (options?.location) return { location: options.location };
    if (options?.branch && options.branch !== "custom") return { branch: options.branch };
    return { branch: "auto" };
}

const PATCH_ACTIONS = new Set(["install", "repair", "uninstall"]);

async function runInstallerAction(action, options = {}) {
    const useHandoff =
        process.platform === "win32" &&
        PATCH_ACTIONS.has(action) &&
        (isPackagedInstaller() || process.env.WIMCORD_INSTALLER_LAUNCHER === "1");

    if (useHandoff) {
        writeFileSync(
            PATCH_REQUEST,
            JSON.stringify({
                action,
                options,
                target: installerTarget(options),
            })
        );

        if (isPackagedInstaller()) {
            sendProgress({
                status: "Patching Discord — a console window may open briefly…",
                log: "\n[Wimcord] Closing UI so Discord files can be patched.\n",
            });
            const env = {
                ...process.env,
                ELECTRON_RUN_AS_NODE: "1",
                WIMCORD_PATCH_WORKER: "1",
                WIMCORD_INSTALLER_PACKAGED: "1",
            };
            ensureWimcordRootEnv();
            spawn(process.execPath, [ENTRY], {
                cwd: getInstallerSpawnCwd(),
                env,
                detached: true,
                stdio: "inherit",
                windowsHide: false,
            });
        } else {
            sendProgress({
                status: "Handing off to launcher — watch the terminal for progress…",
                log: "\n[Wimcord] UI closing so Discord files can be patched. Reopens when done.\n",
            });
        }

        setTimeout(() => app.quit(), 300);
        return { ok: true, pending: true };
    }

    const target = installerTarget(options);
    return runInstallerCliAsync(action, {
        target,
        onStatus: status => sendProgress({ status }),
        onLog: log => sendProgress({ log }),
    });
}

async function runBuild() {
    if (isPackagedInstaller()) {
        return {
            ok: false,
            stdout: "",
            stderr: "",
            error: "This installer already includes a built copy of Wimcord. Go to Install.",
        };
    }
    const pnpm = resolvePnpmBinary();
    sendProgress({ status: "Building Wimcord…" });
    // pnpm.cmd on Windows must run with shell:true or exec through cmd
    const useShell = process.platform === "win32" && pnpm.toLowerCase().endsWith(".cmd");
    return runCommand(pnpm, ["run", "build"], { label: "build", shell: useShell });
}

async function restartDiscord(options = {}) {
    const target = installerTarget(options);
    const found = findDiscordUpdateExe(target);
    if (!found) {
        return {
            ok: false,
            stdout: "",
            stderr: "",
            error: "Could not find Discord (Update.exe) for the selected target.",
        };
    }

    const { updateExe, install } = found;
    const processName = discordProcessName(install);

    await new Promise((resolve, reject) => {
        const child = spawn(updateExe, ["--processStart", processName], {
            detached: true,
            stdio: "ignore",
            windowsHide: false,
            shell: false,
        });
        child.on("error", reject);
        child.unref();
        resolve();
    });

    return { ok: true, stdout: `Started ${processName}\n`, stderr: "" };
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 900,
        height: 520,
        minWidth: 820,
        minHeight: 480,
        resizable: true,
        title: "Wimcord Installer",
        backgroundColor: "#09090b",
        autoHideMenuBar: true,
        webPreferences: {
            preload: join(__dirname, "preload.cjs"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
    });

    const uiIndex = join(__dirname, "ui", "dist", "index.html");
    if (!existsSync(uiIndex)) {
        console.error("[Wimcord] UI not built. Run: pnpm run wimcord:installer:build-ui");
        app.quit();
        return;
    }
    mainWindow.loadFile(uiIndex);

    mainWindow.on("closed", () => {
        if (logWindow && !logWindow.isDestroyed()) logWindow.close();
        mainWindow = null;
    });
}

if (gotSingleInstanceLock) {
app.on("second-instance", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
    }
});

app.whenReady().then(async () => {
    ensureInstallerBinary(msg => sendProgress({ status: msg })).catch(() => {});

    ipcMain.handle("wimcord-installer-list-discords", () => findDiscordInstalls());

    ipcMain.handle("wimcord-installer-browse-discord", async () => {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ["openDirectory"],
            title: "Select Discord installation folder",
        });
        if (result.canceled || !result.filePaths[0]) return null;
        return result.filePaths[0];
    });

    ipcMain.handle("wimcord-installer-validate-discord", (_, dir) => parseDiscordInstall(dir));

    ipcMain.handle("wimcord-installer-run", async (_, action, options) => {
        const result = await runInstallerAction(action, options);

        if (result.pending) return result;

        if (result.ok && options?.restartDiscord && (action === "install" || action === "repair")) {
            sendProgress({ status: "Restarting Discord…" });
            const restart = await restartDiscord(options);
            result.stdout = (result.stdout || "") + "\n--- Restart ---\n" + (restart.stdout || "");
            if (!restart.ok) result.stderr = (restart.error || "");
        }

        return result;
    });

    ipcMain.handle("wimcord-installer-build", async () => {
        const result = await runBuild();
        if (result.stdout) sendProgress({ log: result.stdout });
        if (result.stderr) sendProgress({ log: result.stderr });
        return result;
    });

    ipcMain.handle("wimcord-installer-restart-discord", (_, options) => restartDiscord(options));

    ipcMain.handle("wimcord-installer-read-result", () => {
        if (!existsSync(RESULT_FILE)) return null;
        try {
            return JSON.parse(readFileSync(RESULT_FILE, "utf-8"));
        } catch {
            return null;
        }
    });

    ipcMain.handle("wimcord-installer-clear-result", () => {
        try {
            if (existsSync(RESULT_FILE)) unlinkSync(RESULT_FILE);
        } catch { /* ignore */ }
    });

    ipcMain.handle("wimcord-installer-close-discord", async (_, options) => {
        const target = installerTarget(options ?? {});
        const { log, ok } = await killDiscordProcesses(target, chunk => sendProgress({ log: chunk }));
        return { ok, log, error: ok ? undefined : "Discord patch files are still locked" };
    });

    ipcMain.handle("wimcord-installer-get-info", () => {
        const release = isPackagedInstaller();
        const patcher = join(ROOT, "dist", "patcher.js");
        return {
            release,
            built: existsSync(patcher),
        };
    });

    ipcMain.handle("wimcord-log-open", () => {
        ensureLogWindow();
    });

    ipcMain.handle("wimcord-log-clear", () => {
        clearLogBuffer();
        mainWindow?.webContents?.send("wimcord-installer-progress", { logClear: true });
    });

    createWindow();
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});
}
