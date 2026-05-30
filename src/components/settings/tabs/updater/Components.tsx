/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Card } from "@components/Card";
import { ErrorCard } from "@components/ErrorCard";
import { Flex } from "@components/Flex";
import { Link } from "@components/Link";
import { Margins } from "@utils/margins";
import { classes } from "@utils/misc";
import { relaunch } from "@utils/native";
import { WIMCORD_BRAND } from "@wimcord-core/branding";
import { checkWimcordRelease, fetchWimcordRelease } from "@wimcord-core/releaseUpdater";
import { openWimcordReleaseModal } from "@wimcord-plugins/wimcordUpdater/ReleaseUpdateModal";
import { changes, checkForUpdates, update, updateError } from "@utils/updater";
import { Button, ConfirmModal, Forms, openModal, React, Toasts, useEffect, useState } from "@webpack/common";

import { runWithDispatch } from "./runWithDispatch";

async function checkGitHubReleaseFirst(): Promise<boolean> {
    const newer = await checkWimcordRelease();
    if (newer) {
        openWimcordReleaseModal(newer);
        Toasts.show({
            message: `${WIMCORD_BRAND.name} ${newer.version} is available — see the update window.`,
            id: Toasts.genId(),
            type: Toasts.Type.MESSAGE,
        });
        return true;
    }
    return false;
}

export interface CommonProps {
    repo: string;
    repoPending: boolean;
}

export function HashLink({ repo, hash, disabled = false }: { repo: string, hash: string, disabled?: boolean; }) {
    return (
        <Link href={`${repo}/commit/${hash}`} disabled={disabled}>
            {hash}
        </Link>
    );
}

export function Changes({ updates, repo, repoPending }: CommonProps & { updates: typeof changes; }) {
    return (
        <Card style={{ padding: "0 0.5em" }} defaultPadding={false}>
            {updates.map(({ hash, author, message }) => (
                <div
                    key={hash}
                    style={{
                        marginTop: "0.5em",
                        marginBottom: "0.5em"
                    }}
                >
                    <code>
                        <HashLink {...{ repo, hash }} disabled={repoPending} />
                    </code>

                    <span style={{
                        marginLeft: "0.5em",
                        color: "var(--text-default)"
                    }}>
                        {message} - {author}
                    </span>
                </div>
            ))}
        </Card>
    );
}

export function Newer(props: CommonProps) {
    return (
        <>
            <Forms.FormText className={Margins.bottom8}>
                Your local copy has more recent commits. Please stash or reset them.
            </Forms.FormText>
            <Changes {...props} updates={changes} />
        </>
    );
}

export function WimcordGitHubReleaseSection() {
    const [label, setLabel] = useState(`Installed release: ${WIMCORD_BRAND.version}`);
    const [checking, setChecking] = useState(false);

    const runReleaseCheck = async () => {
        setChecking(true);
        try {
            if (await checkGitHubReleaseFirst()) {
                setLabel(`Update available: ${WIMCORD_BRAND.name} newer than ${WIMCORD_BRAND.version}`);
                return;
            }
            const latest = await fetchWimcordRelease();
            if (!latest?.version) {
                setLabel("Could not reach GitHub Releases. Try again later.");
                return;
            }
            if (latest.version === WIMCORD_BRAND.version) {
                setLabel(`Up to date on release ${WIMCORD_BRAND.version}`);
            } else {
                setLabel(`Installed ${WIMCORD_BRAND.version} — latest on GitHub is ${latest.version}`);
            }
        } finally {
            setChecking(false);
        }
    };

    useEffect(() => {
        void runReleaseCheck();
    }, []);

    return (
        <>
            <Forms.FormText className={Margins.bottom8}>
                {label}
            </Forms.FormText>
            <Button disabled={checking} onClick={() => void runReleaseCheck()}>
                Check GitHub release
            </Button>
        </>
    );
}

export function Updatable(props: CommonProps) {
    const [updates, setUpdates] = useState(changes);
    const [isChecking, setIsChecking] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);

    const isOutdated = (updates?.length ?? 0) > 0;

    return (
        <>
            {!updates && updateError ? (
                <>
                    <Forms.FormText>Failed to check updates. Check the console for more info</Forms.FormText>
                    <ErrorCard style={{ padding: "1em" }}>
                        <p>{updateError.stderr || updateError.stdout || "An unknown error occurred"}</p>
                    </ErrorCard>
                </>
            ) : (
                <Forms.FormText className={Margins.bottom8}>
                    {isOutdated ? (updates.length === 1 ? "There is 1 Update" : `There are ${updates.length} Updates`) : "Up to Date!"}
                </Forms.FormText>
            )}

            {isOutdated && <Changes updates={updates} {...props} />}

            <Flex className={classes(Margins.bottom8, Margins.top8)}>
                {isOutdated && (
                    <Button
                        disabled={isUpdating || isChecking}
                        onClick={runWithDispatch(setIsUpdating, async () => {
                            if (await update()) {
                                setUpdates([]);

                                await new Promise<void>(r => {
                                    openModal(props => (
                                        <ConfirmModal
                                            {...props}
                                            title="Update Success!"
                                            subtitle="Successfully updated. Restart now to apply the changes?"
                                            confirmText="Restart"
                                            cancelText="Not now!"
                                            variant="primary"
                                            onConfirm={() => {
                                                relaunch();
                                                r();
                                            }}
                                            onCancel={r}
                                        />
                                    ));
                                });
                            }
                        })}
                    >
                        Update Now
                    </Button>
                )}
                <Button
                    disabled={isUpdating || isChecking}
                    onClick={runWithDispatch(setIsChecking, async () => {
                        if (await checkGitHubReleaseFirst()) {
                            return;
                        }

                        const outdated = await checkForUpdates();

                        if (outdated) {
                            setUpdates(changes);
                        } else {
                            setUpdates([]);

                            Toasts.show({
                                message: "No git updates found. Checked GitHub release too.",
                                id: Toasts.genId(),
                                type: Toasts.Type.MESSAGE,
                                options: {
                                    position: Toasts.Position.BOTTOM
                                }
                            });
                        }
                    })}
                >
                    Check for Updates
                </Button>
            </Flex>
        </>
    );
}
