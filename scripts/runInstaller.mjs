/*
 * Wimcord — runs official Vencord Installer CLI with correct non-interactive flags
 */
import "./checkNodeVersion.js";

import {
    cliArgsForAction,
    runInstallerCliSync,
    WIMCORD_ROOT,
} from "./wimcordInstallerLib.mjs";

const argStart = process.argv.indexOf("--");
const passthrough = argStart === -1 ? [] : process.argv.slice(argStart + 1);

function actionFromPassthrough(args) {
    if (args.includes("--uninstall")) return "uninstall";
    if (args.includes("--repair")) return "repair";
    if (args.includes("--install")) return "install";
    return null;
}

const action = actionFromPassthrough(passthrough);

function targetFromPassthrough(args) {
    const branchIdx = args.indexOf("--branch");
    if (branchIdx !== -1 && args[branchIdx + 1]) return { branch: args[branchIdx + 1] };
    const locIdx = args.indexOf("--location");
    if (locIdx !== -1 && args[locIdx + 1]) return { location: args[locIdx + 1] };
    return { branch: "auto" };
}

try {
    if (action) {
        console.log(`[Wimcord] ${action} (using Vencord Installer CLI from ${WIMCORD_ROOT})`);
        if (process.platform === "win32" && ["install", "repair", "uninstall"].includes(action)) {
            const { killDiscordProcesses } = await import("../installer/discordKill.mjs");
            const target = targetFromPassthrough(passthrough);
            console.log("[Wimcord] Closing Discord if running…");
            const { ok } = await killDiscordProcesses(target, chunk => process.stdout.write(chunk));
            if (!ok) {
                console.error("[Wimcord] Discord is still running. Quit it from the system tray, then try again.");
                process.exit(1);
            }
        }
        await runInstallerCliSync(action);
    } else if (passthrough.length > 0) {
        const { ensureInstallerBinary, installerEnv } = await import("./wimcordInstallerLib.mjs");
        const { execFileSync } = await import("child_process");
        const bin = await ensureInstallerBinary();
        console.log(`[Wimcord] Running ${bin} ${passthrough.join(" ")}`);
        execFileSync(bin, passthrough, { stdio: "inherit", env: installerEnv() });
    } else {
        console.log("[Wimcord] No action specified. Use: --install | --repair | --uninstall");
        console.log("  pnpm run inject");
        console.log("  pnpm run uninject");
        process.exit(1);
    }
} catch (e) {
    console.error("[Wimcord] Installer failed:", e?.message ?? e);
    process.exit(1);
}
