/**
 * Electron entry — GUI or patch worker (packaged .exe).
 */
async function fatal(title, err) {
    const msg = err?.stack ?? err?.message ?? String(err);
    console.error(`[Wimcord Installer] ${title}:`, msg);
    try {
        const { dialog } = await import("electron");
        dialog.showErrorBox(title, msg);
    } catch { /* headless patch worker */ }
    process.exit(1);
}

try {
    const { ensureWimcordRootEnv } = await import("./paths.mjs");
    ensureWimcordRootEnv();

    if (process.env.WIMCORD_PATCH_WORKER === "1") {
        await import("./patch-worker.mjs");
    } else {
        await import("./main.mjs");
    }
} catch (err) {
    await fatal("Wimcord Installer failed to start", err);
}
