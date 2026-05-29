import type { Action } from "@/hooks/useInstaller";

export interface CompletionInfo {
    title: string;
    description: string;
    variant: "success" | "error";
}

export function completionFromResult(
    action: Action | string | undefined,
    ok: boolean,
    error?: string
): CompletionInfo {
    if (ok) {
        switch (action) {
            case "install":
                return {
                    title: "Wimcord installed successfully",
                    description: "Discord is patched. Open Discord to use Wimcord.",
                    variant: "success",
                };
            case "uninstall":
                return {
                    title: "Wimcord uninstalled successfully",
                    description: "Discord was restored to stock. You can reinstall anytime from Overview.",
                    variant: "success",
                };
            case "repair":
                return {
                    title: "Repair completed successfully",
                    description: "The patch was re-applied to your Discord install.",
                    variant: "success",
                };
            default:
                return {
                    title: "Done",
                    description: "The operation finished successfully.",
                    variant: "success",
                };
        }
    }

    const actionLabel =
        action === "install" ? "Install" : action === "uninstall" ? "Uninstall" : action === "repair" ? "Repair" : "Operation";

    return {
        title: `${actionLabel} failed`,
        description: error ?? "Check Logs for details.",
        variant: "error",
    };
}
