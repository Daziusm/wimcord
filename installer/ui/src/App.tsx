import {
    AlertTriangle,
    CheckCircle2,
    Download,
    ExternalLink,
    Hammer,
    Home,
    Loader2,
    Package,
    RefreshCw,
    Settings2,
    Trash2,
    Wrench,
} from "lucide-react";

import { CompletionBanner } from "@/components/CompletionBanner";
import { DiscordChannelPicker, SelectedDiscordHint } from "@/components/DiscordChannelPicker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { type InstallerView, useInstaller } from "@/hooks/useInstaller";
import { cn } from "@/lib/utils";

const VERSION = "0.1.1";

const NAV: { id: InstallerView; label: string; icon: typeof Home }[] = [
    { id: "overview", label: "Overview", icon: Home },
    { id: "build", label: "Build", icon: Hammer },
    { id: "install", label: "Install", icon: Download },
    { id: "manage", label: "Manage", icon: Settings2 },
];

function navItems(releaseMode: boolean) {
    return releaseMode ? NAV.filter(n => n.id !== "build") : NAV;
}

export default function App() {
    const i = useInstaller();

    return (
        <div className="flex h-screen flex-col overflow-hidden bg-background">
            <header className="flex h-11 shrink-0 items-center justify-between border-b px-4">
                <div className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    <span className="text-sm font-semibold">Wimcord Setup</span>
                    <Badge variant="outline" className="font-mono text-[10px]">
                        v{VERSION}
                    </Badge>
                </div>
                <div className="flex min-w-0 flex-1 items-center justify-center px-4">
                    <p className="flex items-center gap-2 truncate text-xs text-muted-foreground">
                        {i.busy && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />}
                        <span className="truncate">{i.status}</span>
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs" onClick={i.openLogs}>
                        <ExternalLink className="h-3.5 w-3.5" />
                        Logs
                    </Button>
                    <StatusBadge busy={i.busy} outcome={i.outcome} />
                </div>
            </header>

            {i.busy ? <Progress value={null} className="h-0.5 shrink-0 rounded-none" /> : null}

            {i.completion ? (
                <CompletionBanner
                    completion={i.completion}
                    onDismiss={i.dismissCompletion}
                    onViewLogs={i.openLogs}
                />
            ) : null}

            <div className="grid min-h-0 flex-1 grid-cols-[200px_minmax(0,1fr)]">
                <aside className="flex flex-col border-r bg-muted/10 p-2">
                    <nav className="space-y-0.5">
                        {navItems(i.releaseMode).map(item => {
                            const Icon = item.icon;
                            const active = i.view === item.id;
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    disabled={i.busy}
                                    onClick={() => i.setView(item.id)}
                                    className={cn(
                                        "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm",
                                        active
                                            ? "bg-accent font-medium text-accent-foreground"
                                            : "text-muted-foreground hover:bg-accent/50",
                                        i.busy && "pointer-events-none opacity-50"
                                    )}
                                >
                                    <Icon className="h-4 w-4 shrink-0" />
                                    {item.label}
                                </button>
                            );
                        })}
                    </nav>

                    <Separator className="my-2" />

                    <SidebarActions view={i.view} installer={i} />

                    <div className="mt-auto space-y-1 pt-2 text-[10px] text-muted-foreground">
                        {i.releaseMode ? (
                            <p>Wimcord build bundled</p>
                        ) : (
                            <>
                                <StatusLine ok={i.built} label="Build" />
                                <StatusLine ok={i.installed} label="Patch" />
                            </>
                        )}
                    </div>
                </aside>

                <main className="flex min-h-0 flex-col overflow-hidden p-5">
                    <div className="flex min-h-0 flex-1 flex-col justify-center">
                        {i.view === "overview" && (
                            <OverviewPane
                                installs={i.discordInstalls}
                                target={i.discordTarget}
                                useCustom={i.useCustomPath}
                                busy={i.busy}
                                releaseMode={i.releaseMode}
                                onSelectBranch={i.startFlowForBranch}
                                onCustomBrowse={i.startFlowForCustom}
                            />
                        )}
                        {i.view === "build" && (
                            <BuildPane built={i.built} busy={i.busy} operation={i.operation} />
                        )}
                        {i.view === "install" && (
                            <InstallPane
                                built={i.built}
                                restartDiscord={i.restartDiscord}
                                onRestartChange={i.setRestartDiscord}
                                busy={i.busy}
                                target={i.discordTarget}
                                useCustom={i.useCustomPath}
                                customPath={i.customPath}
                                installs={i.discordInstalls}
                            />
                        )}
                        {i.view === "manage" && (
                            <ManagePane
                                target={i.discordTarget}
                                useCustom={i.useCustomPath}
                                customPath={i.customPath}
                                installs={i.discordInstalls}
                            />
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}

function SidebarActions({
    view,
    installer: i,
}: {
    view: InstallerView;
    installer: ReturnType<typeof useInstaller>;
}) {
    return (
        <div className="flex flex-col gap-1.5">
            {view === "build" && (
                <>
                    <Button size="sm" className="w-full" disabled={i.busy} onClick={i.runBuild}>
                        {i.busy && i.operation === "build" ? "Building…" : i.built ? "Rebuild" : "Build"}
                    </Button>
                    {i.built && (
                        <Button size="sm" variant="outline" className="w-full" disabled={i.busy} onClick={() => i.setView("install")}>
                            Continue to Install
                        </Button>
                    )}
                </>
            )}
            {view === "install" && (
                <>
                    <Button
                        size="sm"
                        className="w-full"
                        disabled={i.busy || !i.built}
                        onClick={() => i.runAction("install")}
                    >
                        {i.busy && i.operation === "install" ? "Installing…" : "Install"}
                    </Button>
                    <Button size="sm" variant="outline" className="w-full" disabled={i.busy} onClick={() => i.setView("overview")}>
                        Change Discord
                    </Button>
                </>
            )}
            {view === "manage" && (
                <>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="w-full justify-start gap-2 text-xs"
                        disabled={i.busy}
                        onClick={() => i.closeDiscord()}
                    >
                        Force close Discord
                    </Button>
                    <Button size="sm" variant="secondary" className="w-full justify-start gap-2" disabled={i.busy} onClick={() => i.runAction("repair")}>
                        <Wrench className="h-3.5 w-3.5" />
                        Repair
                    </Button>
                    <Button size="sm" variant="outline" className="w-full justify-start gap-2" disabled={i.busy} onClick={i.runRestart}>
                        <RefreshCw className="h-3.5 w-3.5" />
                        Restart
                    </Button>
                    <Button size="sm" variant="destructive" className="w-full justify-start gap-2" disabled={i.busy} onClick={() => i.runAction("uninstall")}>
                        <Trash2 className="h-3.5 w-3.5" />
                        Uninstall
                    </Button>
                </>
            )}
        </div>
    );
}

function StatusLine({ ok, label }: { ok: boolean; label: string }) {
    return (
        <p className="flex items-center gap-1.5">
            {ok ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <span className="h-3 w-3 rounded-full border" />}
            {label}: {ok ? "done" : "pending"}
        </p>
    );
}

function StatusBadge({ busy, outcome }: { busy: boolean; outcome: "idle" | "success" | "error" }) {
    if (busy) return <Badge variant="secondary" className="text-[10px]">Working</Badge>;
    if (outcome === "success") return <Badge variant="success" className="text-[10px]">OK</Badge>;
    if (outcome === "error") return <Badge variant="destructive" className="text-[10px]">Failed</Badge>;
    return <Badge variant="outline" className="text-[10px]">Ready</Badge>;
}

function OverviewPane({
    installs,
    target,
    useCustom,
    busy,
    releaseMode,
    onSelectBranch,
    onCustomBrowse,
}: {
    installs: ReturnType<typeof useInstaller>["discordInstalls"];
    target: ReturnType<typeof useInstaller>["discordTarget"];
    useCustom: boolean;
    busy: boolean;
    releaseMode: boolean;
    onSelectBranch: ReturnType<typeof useInstaller>["startFlowForBranch"];
    onCustomBrowse: ReturnType<typeof useInstaller>["startFlowForCustom"];
}) {
    return (
        <div className="mx-auto w-full max-w-xl space-y-4">
            <div>
                <h1 className="text-lg font-semibold">Choose Discord</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    {releaseMode
                        ? "Pick a client, then install Wimcord into Discord."
                        : "Click a client to build Wimcord, then you\u2019ll land on Install when the build finishes."}
                </p>
            </div>
            <DiscordChannelPicker
                installs={installs}
                target={target}
                useCustom={useCustom}
                busy={busy}
                onSelectBranch={onSelectBranch}
                onCustomBrowse={onCustomBrowse}
            />
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Quit Discord fully before uninstall (system tray too). Logs open in a separate window.
            </p>
        </div>
    );
}

function BuildPane({
    built,
    busy,
    operation,
}: {
    built: boolean;
    busy: boolean;
    operation: string;
}) {
    return (
        <div className="mx-auto w-full max-w-lg space-y-3">
            <h1 className="text-lg font-semibold">Building</h1>
            {busy && operation === "build" ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Compiling Wimcord — watch the log window for details…
                </p>
            ) : (
                <p className="text-sm text-muted-foreground">
                    Runs <code className="rounded bg-muted px-1 text-xs">pnpm run build</code>.
                    {built ? " Build finished — open Install in the sidebar." : ""}
                </p>
            )}
            {built && (
                <p className="flex items-center gap-1.5 text-xs text-emerald-500">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    dist/ is ready.
                </p>
            )}
        </div>
    );
}

function InstallPane({
    built,
    restartDiscord,
    onRestartChange,
    busy,
    target,
    useCustom,
    customPath,
    installs,
}: {
    built: boolean;
    restartDiscord: boolean;
    onRestartChange: (v: boolean) => void;
    busy: boolean;
    target: ReturnType<typeof useInstaller>["discordTarget"];
    useCustom: boolean;
    customPath: string;
    installs: ReturnType<typeof useInstaller>["discordInstalls"];
}) {
    return (
        <div className="mx-auto w-full max-w-lg space-y-4">
            <h1 className="text-lg font-semibold">Install</h1>
            <SelectedDiscordHint target={target} useCustom={useCustom} customPath={customPath} installs={installs} />
            {!built && (
                <p className="flex items-center gap-1.5 text-xs text-amber-500">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Build not complete — go to Overview and pick a client again.
                </p>
            )}
            <div className="flex items-center gap-2">
                <Checkbox
                    id="restart"
                    checked={restartDiscord}
                    onCheckedChange={v => onRestartChange(v === true)}
                    disabled={busy}
                />
                <Label htmlFor="restart" className="text-sm font-normal">
                    Restart Discord after install
                </Label>
            </div>
            <p className="text-sm text-muted-foreground">Click Install in the sidebar when ready.</p>
        </div>
    );
}

function ManagePane({
    target,
    useCustom,
    customPath,
    installs,
}: {
    target: ReturnType<typeof useInstaller>["discordTarget"];
    useCustom: boolean;
    customPath: string;
    installs: ReturnType<typeof useInstaller>["discordInstalls"];
}) {
    return (
        <div className="mx-auto w-full max-w-lg space-y-3">
            <h1 className="text-lg font-semibold">Manage</h1>
            <SelectedDiscordHint target={target} useCustom={useCustom} customPath={customPath} installs={installs} />
            <p className="text-sm text-muted-foreground">Repair, restart, or uninstall using the sidebar actions.</p>
        </div>
    );
}
