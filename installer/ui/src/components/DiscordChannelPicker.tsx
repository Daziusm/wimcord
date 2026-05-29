import { FlaskConical, FolderOpen, MessageCircle, Radio, TestTube2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DiscordBranch, DiscordInstallInfo, DiscordTarget } from "@/hooks/useInstaller";

const CHANNELS: {
    branch: Exclude<DiscordBranch, "custom">;
    label: string;
    sub: string;
    icon: typeof MessageCircle;
}[] = [
    { branch: "stable", label: "Stable", sub: "Default Discord", icon: MessageCircle },
    { branch: "ptb", label: "PTB", sub: "Public test build", icon: Radio },
    { branch: "canary", label: "Canary", sub: "Early releases", icon: FlaskConical },
    { branch: "dev", label: "Development", sub: "Dev channel", icon: TestTube2 },
];

export function DiscordChannelPicker({
    installs,
    target,
    useCustom,
    busy,
    onSelectBranch,
    onCustomBrowse,
}: {
    installs: DiscordInstallInfo[];
    target: DiscordTarget;
    useCustom: boolean;
    busy: boolean;
    onSelectBranch: (branch: Exclude<DiscordBranch, "custom">) => void;
    onCustomBrowse: () => void;
}) {
    const byBranch = new Map(installs.map(i => [i.branch, i]));

    return (
        <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
                Choose a client to patch. You&apos;ll build Wimcord, then install automatically.
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {CHANNELS.map(ch => {
                    const install = byBranch.get(ch.branch);
                    const Icon = ch.icon;
                    const selected =
                        !useCustom && target.mode === "branch" && target.branch === ch.branch;
                    const disabled = busy || !install;

                    return (
                        <button
                            key={ch.branch}
                            type="button"
                            disabled={disabled}
                            title={install ? install.path : "Not installed on this PC"}
                            onClick={() => install && onSelectBranch(ch.branch)}
                            className={cn(
                                "flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors",
                                selected
                                    ? "border-primary bg-primary/10 ring-1 ring-primary"
                                    : install
                                        ? "border-border bg-card hover:border-primary/50 hover:bg-accent/30"
                                        : "cursor-not-allowed border-border/40 opacity-40",
                                disabled && !selected && "pointer-events-none"
                            )}
                        >
                            <div
                                className={cn(
                                    "flex h-11 w-11 items-center justify-center rounded-full border",
                                    selected ? "border-primary bg-primary/20" : "bg-muted"
                                )}
                            >
                                <Icon className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-sm font-medium">{ch.label}</p>
                                <p className="text-[10px] text-muted-foreground">{ch.sub}</p>
                            </div>
                            {install ? (
                                <Badge variant={install.patched ? "success" : "outline"} className="text-[10px]">
                                    {install.patched ? "Patched" : `v${install.version}`}
                                </Badge>
                            ) : (
                                <Badge variant="secondary" className="text-[10px]">
                                    Not installed
                                </Badge>
                            )}
                        </button>
                    );
                })}
            </div>

            <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={busy}
                onClick={onCustomBrowse}
            >
                <FolderOpen className="h-4 w-4" />
                Custom installation folder…
            </Button>
        </div>
    );
}

export function SelectedDiscordHint({
    target,
    useCustom,
    customPath,
    installs,
}: {
    target: DiscordTarget;
    useCustom: boolean;
    customPath: string;
    installs: DiscordInstallInfo[];
}) {
    const path =
        useCustom && customPath.trim()
            ? customPath.trim()
            : target.mode === "branch"
                ? installs.find(i => i.branch === target.branch)?.path
                : target.mode === "location"
                    ? target.location
                    : null;

    const label =
        useCustom && customPath.trim()
            ? "Custom"
            : target.mode === "branch"
                ? CHANNELS.find(c => c.branch === target.branch)?.label ?? target.branch
                : "Custom";

    if (!path) return null;

    return (
        <p className="truncate rounded-md border bg-muted/30 px-3 py-2 font-mono text-[11px] text-muted-foreground">
            Target: <span className="text-foreground">{label}</span> — {path}
        </p>
    );
}
