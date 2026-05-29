/// <reference types="vite/client" />

import type { DiscordInstallInfo, RunOptions } from "./hooks/useInstaller";

export interface WimcordInstallerApi {
    run: (
        action: "install" | "repair" | "uninstall",
        options?: RunOptions
    ) => Promise<{
        ok: boolean;
        pending?: boolean;
        stdout?: string;
        stderr?: string;
        error?: string;
    }>;
    readLastResult: () => Promise<{
        ok: boolean;
        pending?: boolean;
        log?: string;
        status?: string;
        error?: string;
        action?: string;
        message?: string;
    } | null>;
    clearLastResult: () => Promise<void>;
    build: () => Promise<{ ok: boolean; stdout?: string; stderr?: string; error?: string }>;
    restartDiscord: (options?: RunOptions) => Promise<{
        ok: boolean;
        stdout?: string;
        stderr?: string;
        error?: string;
    }>;
    listDiscords: () => Promise<DiscordInstallInfo[]>;
    browseDiscord: () => Promise<string | null>;
    validateDiscord: (dir: string) => Promise<DiscordInstallInfo | null>;
    openLogs: () => Promise<void>;
    clearLogs: () => Promise<void>;
    closeDiscord: (options?: RunOptions) => Promise<{ ok: boolean; log?: string; error?: string }>;
    getInfo: () => Promise<{ release: boolean; built: boolean }>;
    onProgress: (callback: (data: { status?: string; log?: string; logClear?: boolean }) => void) => () => void;
}

declare global {
    interface Window {
        wimcordInstaller: WimcordInstallerApi;
    }
}
