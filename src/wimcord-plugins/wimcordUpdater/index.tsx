/*
 * Wimcord — release update notifier + install modal
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { showNotification } from "@api/Notifications";
import { Button } from "@components/Button";
import { Divider } from "@components/Divider";
import { HeadingSecondary } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { relaunch } from "@utils/native";
import { checkForUpdates, update } from "@utils/updater";
import { Forms, Modal, openModal, React } from "@webpack/common";

import { WIMCORD_PUBLIC_RELEASE } from "@wimcord-core/publicRelease";
import {
    checkWimcordRelease,
    dismissWimcordRelease,
    type WimcordReleaseManifest,
} from "@wimcord-core/releaseUpdater";
import { recordDiagnostic } from "@wimcord-core/diagnostics";

function ReleaseUpdateModal({
    manifest,
    onClose,
    ...props
}: {
    manifest: WimcordReleaseManifest;
    onClose: () => void;
} & React.ComponentProps<typeof Modal>) {
    const [installing, setInstalling] = React.useState(false);
    const [log, setLog] = React.useState("");

    const runGitUpdate = async () => {
        setInstalling(true);
        setLog("Checking git updates…\n");
        try {
            const outdated = await checkForUpdates();
            if (!outdated) {
                setLog(l => l + "Already on latest commit.\n");
                return;
            }
            setLog(l => l + "Pulling…\n");
            await update();
            setLog(l => l + "Done. Restart Discord.\n");
            recordDiagnostic("update", `Updated to ${manifest.version}`, { level: "info" });
        } catch (e) {
            setLog(l => l + `Error: ${e}\n`);
        } finally {
            setInstalling(false);
        }
    };

    const runInstaller = async () => {
        if (!IS_DISCORD_DESKTOP) return;
        setInstalling(true);
        setLog("Running installer…\n");
        const res = await VencordNative.wimcord.runInstaller("install");
        setLog(l => l + (res.stdout ?? "") + (res.stderr ?? "") + (res.ok ? "\nSuccess.\n" : `\nFailed: ${res.error}\n`));
        setInstalling(false);
    };

    return (
        <Modal {...props} onClose={onClose} title={`${WIMCORD_BRAND.name} ${manifest.version} available`}>
            <Forms.FormText>{manifest.notes ?? "A new Wimcord release is available."}</Forms.FormText>
            {manifest.publishedAt && (
                <Paragraph style={{ color: "var(--text-muted)" }}>Published {manifest.publishedAt}</Paragraph>
            )}

            <Divider />

            <HeadingSecondary>Install</HeadingSecondary>
            <Paragraph>
                Current: {WIMCORD_BRAND.version} → New: {manifest.version}
            </Paragraph>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                {!WIMCORD_PUBLIC_RELEASE && (
                    <Button onClick={runGitUpdate} disabled={installing}>
                        Update source (git)
                    </Button>
                )}
                {!WIMCORD_PUBLIC_RELEASE && IS_DISCORD_DESKTOP && (
                    <Button onClick={runInstaller} disabled={installing}>
                        Re-inject Discord
                    </Button>
                )}
                {manifest.installerUrl && (
                    <Button
                        variant="link"
                        onClick={() => VencordNative.native.openExternal(manifest.installerUrl!)}
                    >
                        Open release page
                    </Button>
                )}
                <Button variant="secondary" onClick={() => dismissWimcordRelease(manifest.version).then(onClose)}>
                    Dismiss
                </Button>
            </div>

            {log && (
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
            )}

            <Divider />
            <Button onClick={relaunch}>Restart Discord</Button>
        </Modal>
    );
}

function openReleaseModal(manifest: WimcordReleaseManifest) {
    openModal(props => (
        <ReleaseUpdateModal
            {...props}
            manifest={manifest}
            onClose={props.onClose}
        />
    ));
}

export default definePlugin({
    name: "WimcordUpdater",
    description: "Notifies when a new Wimcord release is published and offers an update modal",
    authors: [Devs.Wimcord],
    required: true,

    async start() {
        const manifest = await checkWimcordRelease();
        if (!manifest) return;

        recordDiagnostic("release-check", `New release ${manifest.version}`, { level: "info" });

        showNotification({
            title: `${WIMCORD_BRAND.name} ${manifest.version} is available`,
            body: manifest.notes ?? "Click to open the update installer.",
            permanent: true,
            onClick: () => openReleaseModal(manifest),
        });
    },
});
