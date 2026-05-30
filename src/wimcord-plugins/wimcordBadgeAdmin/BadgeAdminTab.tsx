/*
 * Wimcord Badge Admin — settings tab (allowlisted user only)
 */

import { Button } from "@components/Button";
import { Divider } from "@components/Divider";
import { HeadingSecondary } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { SettingsTab } from "@components/settings/tabs/BaseTab";
import {
    deleteAdminBadge,
    fetchAdminRegistry,
    getBadgeAdminKey,
    saveBadgeAdminKeyAndTest,
    type WimcordAdminRegistry,
} from "@wimcord-core/badgeAdmin";
import { resolveBadgeIconUrl } from "@wimcord-core/badgeIconUrl";
import type { WimcordBadgeDefinition } from "@wimcord-core/types";
import { React } from "@webpack/common";

import { openBadgeEditorModal, openGrantModal } from "./modals";

function countGrantees(registry: WimcordAdminRegistry, badgeId: string): number {
    let n = 0;
    for (const ids of Object.values(registry.grants ?? {})) {
        if (Array.isArray(ids) && ids.includes(badgeId)) n++;
    }
    return n;
}

function BadgeCard({
    badge,
    grantCount,
    onEdit,
    onGrant,
    onDelete,
}: {
    badge: WimcordBadgeDefinition;
    grantCount: number;
    onEdit: () => void;
    onGrant: () => void;
    onDelete: () => void;
}) {
    const icon = resolveBadgeIconUrl(badge.iconSrc);
    const canDelete = badge.id !== "user";

    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: 12,
                borderRadius: 8,
                background: "var(--background-secondary)",
                border: "1px solid var(--background-modifier-accent)",
            }}
        >
            <img
                src={icon}
                alt=""
                width={36}
                height={36}
                style={{ borderRadius: "50%", flexShrink: 0 }}
                onError={e => { (e.target as HTMLImageElement).style.visibility = "hidden"; }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: "var(--header-primary)" }}>
                    {badge.description}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-code)" }}>
                    {badge.id}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                    {grantCount} user{grantCount === 1 ? "" : "s"}
                </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                <Button size="small" variant="secondary" onClick={onEdit}>Edit</Button>
                <Button size="small" onClick={onGrant}>Grant</Button>
                {canDelete ? (
                    <Button size="small" variant="dangerSecondary" onClick={onDelete}>Delete</Button>
                ) : null}
            </div>
        </div>
    );
}

function WimcordBadgeAdminTab() {
    const [adminKey, setAdminKey] = React.useState("");
    const [connected, setConnected] = React.useState(false);
    const [registry, setRegistry] = React.useState<WimcordAdminRegistry | null>(null);
    const [loading, setLoading] = React.useState(false);
    const [status, setStatus] = React.useState<string | null>(null);

    const loadRegistry = React.useCallback(async () => {
        setLoading(true);
        setStatus(null);
        try {
            const data = await fetchAdminRegistry();
            setRegistry(data);
            setConnected(true);
        } catch (e) {
            setConnected(false);
            setRegistry(null);
            setStatus(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        void getBadgeAdminKey().then(async key => {
            if (!key) return;
            setAdminKey(key);
            await loadRegistry();
        });
    }, [loadRegistry]);

    const refresh = () => void loadRegistry();

    return (
        <SettingsTab>
            <HeadingSecondary>Badge Admin</HeadingSecondary>
            <Paragraph style={{ fontSize: 13, opacity: 0.9 }}>
                Manage Wimcord custom profile badges on the registry server. Only visible to your account.
            </Paragraph>

            <Divider />

            <HeadingSecondary>Server connection</HeadingSecondary>
            <Paragraph style={{ fontSize: 12, opacity: 0.85 }}>
                Paste the admin secret from your server (<code>WIMCORD_BADGE_ADMIN_KEY</code>). It is stored only on this device.
            </Paragraph>
            <input
                type="password"
                value={adminKey}
                onChange={e => setAdminKey(e.target.value)}
                placeholder="Admin bearer token"
                style={{
                    width: "100%",
                    padding: 10,
                    marginTop: 8,
                    marginBottom: 8,
                    borderRadius: 6,
                    border: "1px solid var(--background-modifier-accent)",
                    background: "var(--input-background)",
                    color: "var(--text-normal)",
                }}
            />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Button
                    disabled={loading || !adminKey.trim()}
                    onClick={async () => {
                        setStatus(null);
                        setLoading(true);
                        try {
                            await saveBadgeAdminKeyAndTest(adminKey);
                            setConnected(true);
                            await loadRegistry();
                            setStatus("Connected to badge server.");
                        } catch (e) {
                            setConnected(false);
                            setRegistry(null);
                            setStatus(e instanceof Error ? e.message : String(e));
                        } finally {
                            setLoading(false);
                        }
                    }}
                >
                    {connected ? "Reconnect" : "Connect"}
                </Button>
                {connected ? (
                    <Button variant="secondary" disabled={loading} onClick={refresh}>
                        Refresh registry
                    </Button>
                ) : null}
            </div>

            {status ? (
                <Paragraph style={{ fontSize: 12, marginTop: 10, color: connected ? "var(--text-muted)" : "var(--status-danger)" }}>
                    {status}
                </Paragraph>
            ) : null}

            {connected && registry ? (
                <>
                    <Divider />

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                        <HeadingSecondary>Badges</HeadingSecondary>
                        <div style={{ display: "flex", gap: 8 }}>
                            <Button
                                onClick={() => openBadgeEditorModal({ onSaved: refresh })}
                            >
                                Create badge
                            </Button>
                            <Button
                                variant="secondary"
                                onClick={() => openGrantModal({ registry, onDone: refresh })}
                            >
                                Grant / revoke
                            </Button>
                        </div>
                    </div>

                    <Paragraph style={{ fontSize: 12, opacity: 0.85, marginBottom: 12 }}>
                        {registry.badges.length} badge type{registry.badges.length === 1 ? "" : "s"}
                        {" · "}
                        {Object.keys(registry.grants).length} users with grants
                    </Paragraph>

                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {registry.badges.map(badge => (
                            <BadgeCard
                                key={badge.id}
                                badge={badge}
                                grantCount={countGrantees(registry, badge.id)}
                                onEdit={() => openBadgeEditorModal({ existing: badge, onSaved: refresh })}
                                onGrant={() => openGrantModal({ registry, prefillBadgeId: badge.id, onDone: refresh })}
                                onDelete={async () => {
                                    if (!confirm(`Delete badge "${badge.id}"? Users will lose this badge.`)) return;
                                    setLoading(true);
                                    try {
                                        await deleteAdminBadge(badge.id);
                                        await loadRegistry();
                                        setStatus(`Deleted "${badge.id}".`);
                                    } catch (e) {
                                        setStatus(e instanceof Error ? e.message : String(e));
                                    } finally {
                                        setLoading(false);
                                    }
                                }}
                            />
                        ))}
                    </div>
                </>
            ) : loading ? (
                <Paragraph style={{ marginTop: 16, fontSize: 12, opacity: 0.8 }}>Loading…</Paragraph>
            ) : null}
        </SettingsTab>
    );
}

export default WimcordBadgeAdminTab;
