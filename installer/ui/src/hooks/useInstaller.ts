import { useCallback, useEffect, useState } from "react";

import { completionFromResult, type CompletionInfo } from "@/lib/completionMessage";

export type InstallerView = "overview" | "build" | "install" | "manage";
export type Action = "install" | "repair" | "uninstall";
export type Operation = "idle" | "build" | "install" | "repair" | "uninstall" | "restart";
export type Outcome = "idle" | "success" | "error";
export type DiscordBranch = "stable" | "ptb" | "canary" | "dev" | "custom";

export interface DiscordInstallInfo {
    branch: DiscordBranch;
    path: string;
    version: string;
    patched: boolean;
    label: string;
}

export type DiscordTarget =
    | { mode: "branch"; branch: Exclude<DiscordBranch, "custom"> }
    | { mode: "location"; location: string };

export interface RunOptions {
    restartDiscord?: boolean;
    branch?: string;
    location?: string;
}

function api() {
    if (!window.wimcordInstaller) {
        throw new Error("Installer API unavailable. Run: pnpm run wimcord:installer");
    }
    return window.wimcordInstaller;
}

export function targetToRunOptions(
    target: DiscordTarget,
    useCustom: boolean,
    customPath: string
): Pick<RunOptions, "branch" | "location"> {
    if (useCustom && customPath.trim()) {
        return { location: customPath.trim() };
    }
    if (target.mode === "branch") {
        return { branch: target.branch };
    }
    return { location: target.location };
}

function defaultTarget(installs: DiscordInstallInfo[]): DiscordTarget {
    const preferred = installs.find(i => i.branch === "stable") ?? installs[0];
    if (preferred && preferred.branch !== "custom") {
        return { mode: "branch", branch: preferred.branch as Exclude<DiscordBranch, "custom"> };
    }
    return { mode: "branch", branch: "stable" };
}

export function useInstaller() {
    const [view, setView] = useState<InstallerView>("overview");
    const [busy, setBusy] = useState(false);
    const [operation, setOperation] = useState<Operation>("idle");
    const [status, setStatus] = useState("Ready");
    const [log, setLog] = useState("");
    const [outcome, setOutcome] = useState<Outcome>("idle");
    const [restartDiscord, setRestartDiscord] = useState(true);
    const [built, setBuilt] = useState(false);
    const [installed, setInstalled] = useState(false);
    const [releaseMode, setReleaseMode] = useState(false);

    const [discordInstalls, setDiscordInstalls] = useState<DiscordInstallInfo[]>([]);
    const [discordTarget, setDiscordTarget] = useState<DiscordTarget>({ mode: "branch", branch: "stable" });
    const [useCustomPath, setUseCustomPath] = useState(false);
    const [customPath, setCustomPath] = useState("");
    const [completion, setCompletion] = useState<CompletionInfo | null>(null);

    const refreshDiscords = useCallback(async () => {
        try {
            const list = await api().listDiscords();
            setDiscordInstalls(list);
            setDiscordTarget(prev => {
                if (useCustomPath) return prev;
                if (prev.mode === "branch" && list.some(i => i.branch === prev.branch)) return prev;
                return defaultTarget(list);
            });
        } catch {
            setDiscordInstalls([]);
        }
    }, [useCustomPath]);

    useEffect(() => {
        refreshDiscords();
    }, [refreshDiscords]);

    useEffect(() => {
        api()
            .getInfo?.()
            .then(info => {
                if (info?.release) setReleaseMode(true);
                if (info?.release && info.built) {
                    setBuilt(true);
                }
            })
            .catch(() => {});
    }, []);

    useEffect(() => {
        if (!window.wimcordInstaller?.readLastResult) return;
        window.wimcordInstaller.readLastResult().then(res => {
            if (!res || res.pending) return;

            const info = completionFromResult(res.action, res.ok, res.error ?? res.message);
            if (res.message && res.ok) {
                info.title = res.message;
            }
            setCompletion(info);
            setStatus(info.title);

            if (res.log) setLog(res.log);
            setOutcome(res.ok ? "success" : "error");

            if (res.ok) {
                if (res.action === "uninstall") setInstalled(false);
                else if (res.action === "install" || res.action === "repair") setInstalled(true);
            }

            if (res.action === "install") setView("install");
            else if (res.action === "uninstall" || res.action === "repair") setView("manage");

            refreshDiscords();

            if (!res.ok) api().openLogs();

            window.wimcordInstaller.clearLastResult?.();
        });
    }, [refreshDiscords]);

    useEffect(() => {
        if (!window.wimcordInstaller?.onProgress) return;
        return window.wimcordInstaller.onProgress(({ status: s, log: l, logClear }) => {
            if (s) setStatus(s);
            if (logClear) setLog("");
            if (l) setLog(prev => prev + l);
        });
    }, []);

    const clearLog = useCallback(() => {
        setLog("");
        api().clearLogs();
    }, []);

    const openLogs = useCallback(() => {
        api().openLogs();
    }, []);

    const finish = useCallback((ok: boolean, message: string) => {
        setStatus(message);
        setOutcome(ok ? "success" : "error");
        setBusy(false);
        setOperation("idle");
    }, []);

    const runOpts = useCallback(
        (): RunOptions => ({
            restartDiscord,
            ...targetToRunOptions(discordTarget, useCustomPath, customPath),
        }),
        [restartDiscord, discordTarget, useCustomPath, customPath]
    );

    const runBuildInternal = useCallback(
        async (advanceToInstall: boolean) => {
            clearLog();
            api().openLogs();
            setBusy(true);
            setOutcome("idle");
            setOperation("build");
            setStatus("Compiling Wimcord…");
            setView("build");

            try {
                const res = await api().build();
                if (res.stdout) setLog(prev => prev + res.stdout);
                if (res.stderr) setLog(prev => prev + res.stderr);
                if (res.ok) {
                    setBuilt(true);
                    if (advanceToInstall) {
                        setView("install");
                        finish(true, "Build complete — ready to install");
                    } else {
                        finish(true, "Build complete");
                    }
                } else {
                    finish(false, res.error ?? "Build failed");
                }
            } catch (e) {
                finish(false, e instanceof Error ? e.message : String(e));
            }
        },
        [clearLog, finish]
    );

    const runBuild = useCallback(() => runBuildInternal(false), [runBuildInternal]);

    /** Overview click: select Discord → build → auto-advance to install */
    const startFlowForBranch = useCallback(
        async (branch: Exclude<DiscordBranch, "custom">) => {
            setUseCustomPath(false);
            setDiscordTarget({ mode: "branch", branch });
            if (built || releaseMode) {
                setView("install");
                setStatus(`Selected ${branch} — ready to install`);
                return;
            }
            await runBuildInternal(true);
        },
        [built, releaseMode, runBuildInternal]
    );

    const startFlowForCustom = useCallback(async () => {
        const picked = await api().browseDiscord();
        if (!picked) return;

        setCustomPath(picked);
        setUseCustomPath(true);
        setDiscordTarget({ mode: "location", location: picked });

        if (built || releaseMode) {
            setView("install");
            setStatus("Custom folder selected — ready to install");
            return;
        }
        await runBuildInternal(true);
    }, [built, releaseMode, runBuildInternal]);

    const runAction = useCallback(
        async (action: Action) => {
            if (useCustomPath && !customPath.trim()) {
                setOutcome("error");
                setStatus("Select a Discord client on Overview or pick a custom folder");
                return;
            }

            clearLog();
            api().openLogs();
            setBusy(true);
            setOutcome("idle");
            setOperation(action === "install" ? "install" : action === "repair" ? "repair" : "uninstall");
            setStatus(
                action === "install"
                    ? "Installing into Discord…"
                    : action === "uninstall"
                        ? "Removing patch…"
                        : "Repairing…"
            );

            const options = runOpts();
            const shouldRestart = restartDiscord && (action === "install" || action === "repair");

            try {
                const res = await api().run(action, {
                    ...options,
                    restartDiscord: shouldRestart,
                });
                if (res.pending) {
                    setStatus(
                        releaseMode
                            ? "Patching Discord — the installer will reopen when finished."
                            : "Patching in your terminal — this window will reopen when done."
                    );
                    setBusy(false);
                    setOperation("idle");
                    return;
                }
                if (res.stdout) setLog(prev => prev + res.stdout);
                if (res.stderr) setLog(prev => prev + res.stderr);
                if (res.ok) {
                    if (action === "install" || action === "repair") setInstalled(true);
                    finish(true, res.error ?? (action === "install" ? "Installed successfully" : "Done"));
                    refreshDiscords();
                } else {
                    finish(false, res.error ?? "Operation failed");
                }
            } catch (e) {
                finish(false, e instanceof Error ? e.message : String(e));
            }
        },
        [clearLog, finish, runOpts, restartDiscord, useCustomPath, customPath, refreshDiscords, releaseMode]
    );

    const runRestart = useCallback(async () => {
        clearLog();
        api().openLogs();
        setBusy(true);
        setOutcome("idle");
        setOperation("restart");
        setStatus("Restarting Discord…");
        try {
            const res = await api().restartDiscord(runOpts());
            if (res.stdout) setLog(prev => prev + res.stdout);
            finish(res.ok, res.ok ? "Discord restarted" : (res.error ?? "Failed to restart"));
        } catch (e) {
            finish(false, e instanceof Error ? e.message : String(e));
        }
    }, [clearLog, finish, runOpts]);

    const closeDiscord = useCallback(async () => {
        clearLog();
        api().openLogs();
        setStatus("Closing Discord…");
        try {
            const res = await api().closeDiscord(runOpts());
            if (res.log) setLog(prev => prev + res.log);
            setStatus(res.ok ? "Discord closed" : (res.error ?? "Some Discord processes may still be running"));
            setOutcome(res.ok ? "success" : "error");
        } catch (e) {
            setStatus(e instanceof Error ? e.message : String(e));
            setOutcome("error");
        }
    }, [clearLog, runOpts]);

    return {
        view,
        setView,
        busy,
        operation,
        status,
        log,
        outcome,
        restartDiscord,
        setRestartDiscord,
        built,
        installed,
        clearLog,
        openLogs,
        runAction,
        runBuild,
        runRestart,
        startFlowForBranch,
        startFlowForCustom,
        discordInstalls,
        discordTarget,
        setDiscordTarget,
        useCustomPath,
        setUseCustomPath,
        customPath,
        setCustomPath,
        refreshDiscords,
        closeDiscord,
        completion,
        dismissCompletion: () => setCompletion(null),
        releaseMode,
    };
}
