/*
 * Wimcord Badge Admin — modals
 */

import { Button } from "@components/Button";
import { resolveBadgeIconUrl } from "@wimcord-core/badgeIconUrl";
import {
    grantAdminBadge,
    upsertAdminBadge,
    validateBadgeId,
    validateDiscordUserId,
    type WimcordAdminRegistry,
} from "@wimcord-core/badgeAdmin";
import type { WimcordBadgeDefinition } from "@wimcord-core/types";
import { Margins } from "@utils/margins";
import { RenderModalProps } from "@vencord/discord-types";
import { Forms, Modal, openModal, React, Select, TextInput, Toasts, useState } from "@webpack/common";

function toastOk(message: string) {
    Toasts.show({ id: Toasts.genId(), type: Toasts.Type.SUCCESS, message });
}

function toastErr(message: string) {
    Toasts.show({ id: Toasts.genId(), type: Toasts.Type.FAILURE, message });
}

function afterModalClose(onDone: () => void) {
    queueMicrotask(onDone);
}

const fieldLabel = { marginBottom: 4, fontSize: 12, fontWeight: 600 as const, color: "var(--header-secondary)" };

const modalActions = {
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 20,
    flexWrap: "wrap" as const,
};

export function openBadgeEditorModal(opts: {
    existing?: WimcordBadgeDefinition;
    onSaved: () => void;
}) {
    const existing = opts.existing;

    openModal((props: RenderModalProps) => (
        <BadgeEditorModal
            {...props}
            isEdit={Boolean(existing)}
            initial={{
                id: existing?.id ?? "",
                description: existing?.description ?? "",
                iconSrc: existing?.iconSrc ?? "",
                link: existing?.link ?? "",
            }}
            onSaved={opts.onSaved}
        />
    ));
}

function BadgeEditorModal({
    isEdit,
    initial,
    onSaved,
    ...props
}: RenderModalProps & {
    isEdit: boolean;
    initial: { id: string; description: string; iconSrc: string; link: string };
    onSaved: () => void;
}) {
    const [id, setId] = useState(initial.id);
    const [description, setDescription] = useState(initial.description);
    const [iconSrc, setIconSrc] = useState(initial.iconSrc);
    const [link, setLink] = useState(initial.link);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const preview = iconSrc.trim() ? resolveBadgeIconUrl(iconSrc.trim()) : null;

    async function handleSave() {
        setError(null);
        const idErr = validateBadgeId(id);
        if (idErr) return setError(idErr);
        if (!description.trim()) return setError("Display name is required");
        if (!iconSrc.trim()) return setError("Icon URL is required");

        setBusy(true);
        try {
            await upsertAdminBadge({
                id: id.trim(),
                description: description.trim(),
                iconSrc: iconSrc.trim(),
                link: link.trim() || undefined,
            });
            toastOk(isEdit ? "Badge updated" : "Badge created");
            props.onClose();
            afterModalClose(onSaved);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg);
            toastErr(msg);
        } finally {
            setBusy(false);
        }
    }

    return (
        <Modal
            {...props}
            title={isEdit ? `Edit badge — ${initial.id}` : "Create badge"}
            actions={[
                {
                    text: "Cancel",
                    variant: "secondary",
                    onClick: props.onClose,
                },
                {
                    text: isEdit ? "Save changes" : "Create badge",
                    variant: "primary",
                    onClick: () => void handleSave(),
                },
            ]}
        >
            <Forms.FormSection>
                <div style={fieldLabel}>Badge slug</div>
                <TextInput
                    disabled={isEdit || busy}
                    value={id}
                    onChange={setId}
                    placeholder="early-user"
                />
                <Forms.FormText className={Margins.top8}>
                    Lowercase slug only (not a Discord user id). Example: early-user, founder, beta.
                </Forms.FormText>

                <div style={{ ...fieldLabel, marginTop: 16 }}>Display name</div>
                <TextInput
                    disabled={busy}
                    value={description}
                    onChange={setDescription}
                    placeholder="Early User"
                />

                <div style={{ ...fieldLabel, marginTop: 16 }}>Icon URL</div>
                <TextInput
                    disabled={busy}
                    value={iconSrc}
                    onChange={setIconSrc}
                    placeholder="https://…"
                />
                <Forms.FormText className={Margins.top8}>
                    Prefer your own CDN or Discord emoji URLs. Attachment links with ?ex= expire and show blank.
                </Forms.FormText>

                {preview ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
                        <img
                            src={preview}
                            alt=""
                            width={40}
                            height={40}
                            style={{ borderRadius: "50%", background: "var(--background-secondary)" }}
                            onError={e => { (e.target as HTMLImageElement).style.opacity = "0.3"; }}
                        />
                        <span style={{ fontSize: 12, opacity: 0.8 }}>Preview</span>
                    </div>
                ) : null}

                <div style={{ ...fieldLabel, marginTop: 16 }}>Link (optional)</div>
                <TextInput
                    disabled={busy}
                    value={link}
                    onChange={setLink}
                    placeholder="https://…"
                />
            </Forms.FormSection>

            {error ? (
                <Forms.FormText style={{ color: "var(--text-danger)" }}>{error}</Forms.FormText>
            ) : null}
        </Modal>
    );
}

export function openGrantModal(opts: {
    registry: WimcordAdminRegistry;
    prefillBadgeId?: string;
    prefillUserId?: string;
    onDone: () => void;
}) {
    openModal((props: RenderModalProps) => (
        <GrantModal {...props} {...opts} />
    ));
}

function GrantModal({
    registry,
    prefillBadgeId,
    prefillUserId,
    onDone,
    ...props
}: RenderModalProps & {
    registry: WimcordAdminRegistry;
    prefillBadgeId?: string;
    prefillUserId?: string;
    onDone: () => void;
}) {
    const badgeOptions = registry.badges
        .filter(b => b.id !== "user" || registry.badges.length === 1)
        .map(b => ({ label: `${b.id} — ${b.description}`, value: b.id }));

    const [badgeId, setBadgeId] = useState(prefillBadgeId ?? badgeOptions[0]?.value ?? "");
    const [userId, setUserId] = useState(prefillUserId ?? "");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const grantees = React.useMemo(() => {
        if (!badgeId) return [];
        const out: string[] = [];
        for (const [uid, ids] of Object.entries(registry.grants)) {
            if (Array.isArray(ids) && ids.includes(badgeId)) out.push(uid);
        }
        return out;
    }, [registry.grants, badgeId]);

    async function runGrant(grant: boolean) {
        setError(null);
        const userErr = validateDiscordUserId(userId);
        if (userErr) return setError(userErr);
        if (!badgeId) return setError("Select a badge");

        setBusy(true);
        try {
            await grantAdminBadge(badgeId, userId.trim(), grant);
            toastOk(grant ? "Badge granted" : "Badge revoked");
            props.onClose();
            afterModalClose(onDone);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg);
            toastErr(msg);
        } finally {
            setBusy(false);
        }
    }

    return (
        <Modal {...props} title="Grant or revoke badge">
            <Forms.FormSection>
                {badgeOptions.length === 0 ? (
                    <Forms.FormText>Create a badge first, then grant it to users.</Forms.FormText>
                ) : (
                    <>
                        <div style={fieldLabel}>Badge</div>
                        <Select
                            options={badgeOptions}
                            select={setBadgeId}
                            isSelected={v => v === badgeId}
                            serialize={v => v}
                            closeOnSelect
                        />
                    </>
                )}

                <div style={{ ...fieldLabel, marginTop: 16 }}>Discord user id</div>
                <TextInput
                    disabled={busy}
                    value={userId}
                    onChange={setUserId}
                    placeholder="1365507060535529694"
                />

                {grantees.length > 0 ? (
                    <>
                        <div style={{ ...fieldLabel, marginTop: 16 }}>
                            Currently granted ({grantees.length})
                        </div>
                        <div style={{
                            maxHeight: 120,
                            overflow: "auto",
                            fontSize: 12,
                            fontFamily: "var(--font-code)",
                            background: "var(--background-secondary)",
                            borderRadius: 6,
                            padding: 8,
                        }}>
                            {grantees.map(uid => (
                                <div key={uid} style={{ padding: "2px 0" }}>{uid}</div>
                            ))}
                        </div>
                    </>
                ) : null}
            </Forms.FormSection>

            {error ? (
                <Forms.FormText style={{ color: "var(--text-danger)" }}>{error}</Forms.FormText>
            ) : null}

            <div style={modalActions}>
                <Button variant="secondary" onClick={props.onClose} disabled={busy}>Close</Button>
                <Button
                    variant="dangerSecondary"
                    disabled={busy || !badgeId}
                    onClick={() => void runGrant(false)}
                >
                    Revoke
                </Button>
                <Button
                    disabled={busy || !badgeId}
                    onClick={() => void runGrant(true)}
                >
                    Grant
                </Button>
            </div>
        </Modal>
    );
}
