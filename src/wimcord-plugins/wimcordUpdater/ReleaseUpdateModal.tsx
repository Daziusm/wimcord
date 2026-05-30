/*
 * Wimcord — release update modal
 */

import { Button } from "@components/Button";
import { Divider } from "@components/Divider";
import { HeadingSecondary } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { WIMCORD_BRAND } from "@wimcord-core/branding";
import { WIMCORD_PUBLIC_RELEASE } from "@wimcord-core/publicRelease";
import { dismissWimcordRelease, type WimcordReleaseManifest } from "@wimcord-core/releaseUpdater";
import { relaunch } from "@utils/native";
import { checkForUpdates, update } from "@utils/updater";
import { recordDiagnostic } from "@wimcord-core/diagnostics";
import { Forms, Modal, openModal, React } from "@webpack/common";

export function openWimcordReleaseModal(manifest: WimcordReleaseManifest) {
    openModal(props => (
        <ReleaseUpdateModal
            {...props}
            manifest={manifest}
            onClose={props.onClose}
        />
    ));
}

type ModalProps = Parameters<typeof Modal>[0];

function ReleaseUpdateModal({
    manifest,
    onClose,
    ...props
}: {
    manifest: WimcordReleaseManifest;
    onClose: () => void;
} & ModalProps) {
    const [installing, setInstalling] = React.useState(false);
    const [log, setLog] = React.useState("");

    const appendLog = (line: string) => setLog(l => l + line);

    const runGitUpdate = async () => {
        setInstalling(true);
        appendLog("Checking git updates…\n");
        try {
            const outdated = await checkForUpdates();
            if (!outdated) {
                appendLog("Already on latest commit.\n");
                return;
            }
            appendLog("Pulling…\n");
            await update();
            appendLog("Done. Restart Discord.\n");
            recordDiagnostic("update", `Updated to ${manifest.version}`, { level: "info" });
        } catch (e) {
            appendLog(`Error: ${e}\n`);
        } finally {
            setInstalling(false);
        }
    };

    const runInstaller = async () => {
        if (!IS_DISCORD_DESKTOP) return;
        setInstalling(true);
        appendLog("Running installer…\n");
        const res = await VencordNative.wimcord.runInstaller("install");
        appendLog((res.stdout ?? "") + (res.stderr ?? "") + (res.ok ? "\nSuccess.\n" : `\nFailed: ${res.error}\n`));
        setInstalling(false);
    };

    const applyDistZip = async () => {
        if (!IS_DISCORD_DESKTOP || !manifest.downloadUrl) return;
        setInstalling(true);
        appendLog("Downloading update…\n");
        const res = await VencordNative.wimcord.applyDistUpdate(manifest.downloadUrl);
        if (res.ok) {
            appendLog(`Installed ${res.files ?? 0} file(s). Restart Discord to load ${manifest.version}.\n`);
            recordDiagnostic("update", `Applied dist update ${manifest.version}`, { level: "info" });
        } else {
            appendLog(`Failed: ${res.error ?? "unknown error"}\n`);
        }
        setInstalling(false);
    };

    const canAutoApply = IS_DISCORD_DESKTOP && Boolean(manifest.downloadUrl);

    return (
        <Modal {...props} onClose={onClose} title={`${WIMCORD_BRAND.name} ${manifest.version} available`}>
            <Forms.FormText style={{ whiteSpace: "pre-wrap" }}>
                {manifest.notes ?? "A new Wimcord release is available on GitHub."}
            </Forms.FormText>
            {manifest.publishedAt ? (
                <Paragraph style={{ color: "var(--text-muted)", marginTop: 8 }}>
                    Published {new Date(manifest.publishedAt).toLocaleString()}
                </Paragraph>
            ) : null}

            <Divider />

            <HeadingSecondary>Update</HeadingSecondary>
            <Paragraph>
                Installed: {WIMCORD_BRAND.version} → Latest: {manifest.version}
            </Paragraph>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                {canAutoApply && (
                    <Button onClick={() => void applyDistZip()} disabled={installing}>
                        Install update now
                    </Button>
                )}
                {!WIMCORD_PUBLIC_RELEASE && (
                    <Button onClick={() => void runGitUpdate()} disabled={installing}>
                        Update source (git)
                    </Button>
                )}
                {!WIMCORD_PUBLIC_RELEASE && IS_DISCORD_DESKTOP && (
                    <Button onClick={() => void runInstaller()} disabled={installing}>
                        Re-inject Discord
                    </Button>
                )}
                {manifest.installerUrl && (
                    <Button
                        variant="secondary"
                        onClick={() => VencordNative.native.openExternal(manifest.installerUrl!)}
                    >
                        Open release page
                    </Button>
                )}
                <Button
                    variant="secondary"
                    onClick={() => void dismissWimcordRelease(manifest.version).then(onClose)}
                >
                    Dismiss
                </Button>
            </div>

            {canAutoApply ? (
                <Paragraph style={{ fontSize: 12, opacity: 0.85, marginTop: 10 }}>
                    Install update now replaces your local Wimcord files, then restart Discord. If that fails, use Open release page.
                </Paragraph>
            ) : (
                <Paragraph style={{ fontSize: 12, opacity: 0.85, marginTop: 10 }}>
                    Download the latest release from GitHub, extract it, and run WimcordInstaller.exe, then restart Discord.
                </Paragraph>
            )}

            {log ? (
                <pre style={{
                    marginTop: 12,
                    maxHeight: 160,
                    overflow: "auto",
                    fontSize: 11,
                    padding: 8,
                    background: "var(--background-secondary)",
                    borderRadius: 6,
                }}
                >
                    {log}
                </pre>
            ) : null}

            <Divider />
            <Button onClick={relaunch}>Restart Discord</Button>
        </Modal>
    );
}
