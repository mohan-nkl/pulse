import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getUserProfile } from "../api/profileApi";
import { blockUser, unblockUser, getBlockStatus } from "../api/blockApi";
import { listContacts, updateAlias } from "../api/contactApi";

export default function ViewProfile() {
    const { userId } = useParams();
    const navigate = useNavigate();

    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [isBlocked, setIsBlocked] = useState(false);
    const [working, setWorking] = useState(false);

    const [contactRecord, setContactRecord] = useState(null);
    const [editingName, setEditingName] = useState(false);
    const [aliasInput, setAliasInput] = useState("");
    const [savingAlias, setSavingAlias] = useState(false);

    useEffect(() => {
        getUserProfile(userId)
            .then(setProfile)
            .catch(() => setError("Could not load this profile."))
            .finally(() => setLoading(false));

        getBlockStatus(userId)
            .then((r) => setIsBlocked(!!r.blocked))
            .catch(() => setIsBlocked(false));

        listContacts()
            .then((list) => {
                const record = (list || []).find((c) => String(c.contactId) === String(userId));
                setContactRecord(record || null);
            })
            .catch(() => setContactRecord(null));
    }, [userId]);

    const startEditName = () => {
        setAliasInput(contactRecord?.alias || "");
        setEditingName(true);
    };

    const saveName = async () => {
        if (!contactRecord) return;
        const alias = aliasInput.trim();
        setSavingAlias(true);
        try {
            await updateAlias(contactRecord.id, alias || null);
            const fresh = await getUserProfile(userId);
            setProfile(fresh);
            setContactRecord((record) => (record ? { ...record, alias: alias || null } : record));
            setEditingName(false);
        } catch {
            alert("Could not update the name. Please try again.");
        } finally {
            setSavingAlias(false);
        }
    };

    const toggleBlock = async () => {
        setWorking(true);
        try {
            if (isBlocked) {
                await unblockUser(userId);
                setIsBlocked(false);
            } else {
                await blockUser(userId);
                setIsBlocked(true);
            }
        } catch {
            alert("Action failed. Please try again.");
        } finally {
            setWorking(false);
        }
    };

    const formatLastSeen = (iso) => {
        if (!iso) return "a long time ago";
        const date = new Date(iso);
        const diffMins = Math.floor((Date.now() - date) / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);
        if (diffMins < 1) return "just now";
        if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
        if (diffDays === 1) return "yesterday";
        if (diffDays < 7) return `${diffDays} days ago`;
        return date.toLocaleDateString();
    };

    if (loading) return <div style={styles.center}>Loading…</div>;
    if (error) return <div style={styles.center}>{error}</div>;

    return (
        <div style={styles.container}>
            <style>{css}</style>
            <div style={styles.card}>
                <div style={styles.cover}>
                    <button style={styles.backBtn} className="pulse-back" onClick={() => navigate(-1)} aria-label="Back">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 18 9 12 15 6" />
                        </svg>
                    </button>
                </div>

                <div style={styles.body}>
                    <div style={styles.hero}>
                        <div style={styles.avatarRing}>
                            <img
                                src={profile.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name || "U")}&size=120&background=2c6b5b&color=fff`}
                                alt="avatar"
                                style={styles.avatar}
                            />
                        </div>
                        {editingName ? (
                            <div style={styles.editNameRow}>
                                <input
                                    style={styles.editNameInput}
                                    value={aliasInput}
                                    onChange={(e) => setAliasInput(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && saveName()}
                                    placeholder="Name (leave empty to use the number)"
                                    autoFocus
                                />
                                <button style={styles.editSaveBtn} className="pulse-btn" onClick={saveName} disabled={savingAlias}>
                                    {savingAlias ? "…" : "Save"}
                                </button>
                                <button style={styles.editCancelBtn} onClick={() => setEditingName(false)}>✕</button>
                            </div>
                        ) : (
                            <h2 style={styles.heroName}>
                                {profile.name}
                                {contactRecord && (
                                    <button style={styles.editNameBtn} className="pulse-edit" onClick={startEditName} title="Edit name">
                                        ✎
                                    </button>
                                )}
                            </h2>
                        )}
                        <p style={styles.heroSub}>Last seen {formatLastSeen(profile.lastSeen)}</p>
                    </div>

                    <div style={styles.detailsSection}>
                        {profile.about && (
                            <div style={styles.detailRow}>
                                <span style={styles.detailLabel}>About</span>
                                <span style={styles.detailValue}>{profile.about}</span>
                            </div>
                        )}
                        <div style={styles.detailRowLast}>
                            <span style={styles.detailLabel}>Member since</span>
                            <span style={styles.detailValue}>{new Date(profile.createdAt).toLocaleDateString()}</span>
                        </div>
                    </div>

                    <button
                        style={isBlocked ? styles.unblockBtn : styles.blockBtn}
                        className={isBlocked ? "pulse-btn" : "pulse-block"}
                        onClick={toggleBlock}
                        disabled={working}
                    >
                        {working ? "…" : isBlocked ? "Unblock" : "Block"}
                    </button>
                </div>
            </div>
        </div>
    );
}

const styles = {
    center: {
        display: "flex", justifyContent: "center", alignItems: "center",
        minHeight: "100vh", background: "var(--c-bg)", color: "var(--c-text)",
    },
    container: {
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        padding: "24px",
        boxSizing: "border-box",
        background: "radial-gradient(1200px 500px at 50% -10%, rgba(74,157,137,0.10), transparent 60%), var(--c-bg)",
    },
    card: {
        display: "flex",
        flexDirection: "column",
        width: "400px",
        maxWidth: "100%",
        background: "var(--c-panel)",
        border: "1px solid var(--c-border)",
        borderRadius: "20px",
        boxShadow: "var(--c-shadow)",
        color: "var(--c-text)",
        overflow: "hidden",
    },
    cover: {
        height: "108px",
        position: "relative",
        background: "radial-gradient(420px 200px at 80% 0%, rgba(255,255,255,0.16), transparent 60%), linear-gradient(135deg, var(--c-accent), var(--c-accent-hover))",
    },
    backBtn: {
        position: "absolute",
        top: "14px",
        left: "14px",
        width: "34px",
        height: "34px",
        borderRadius: "50%",
        border: "none",
        cursor: "pointer",
        background: "rgba(255,255,255,0.20)",
        color: "#ffffff",
        display: "grid",
        placeItems: "center",
        transition: "background 0.15s ease",
    },
    body: { padding: "0 28px 28px" },
    hero: { display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "20px" },
    avatarRing: {
        position: "relative",
        zIndex: 2,
        marginTop: "-56px",
        padding: "5px",
        borderRadius: "50%",
        background: "var(--c-panel)",
        boxShadow: "0 6px 20px rgba(0,0,0,0.20)",
    },
    avatar: { width: "104px", height: "104px", borderRadius: "50%", objectFit: "cover", display: "block" },
    heroName: { fontSize: "22px", fontWeight: 600, color: "var(--c-text)", margin: "14px 0 0", display: "inline-flex", alignItems: "center", gap: "8px" },
    heroSub: { fontSize: "13px", color: "var(--c-muted)", margin: "4px 0 0" },
    editNameBtn: {
        background: "none", border: "none", cursor: "pointer", color: "var(--c-muted)",
        fontSize: "15px", lineHeight: 1, padding: "2px 4px",
    },
    editNameRow: { display: "flex", alignItems: "center", gap: "6px", marginTop: "14px", width: "100%" },
    editNameInput: {
        flex: 1, padding: "8px 10px", fontSize: "15px", background: "var(--c-bg)",
        border: "1px solid var(--c-border2)", borderRadius: "8px", color: "var(--c-text)", outline: "none",
    },
    editSaveBtn: {
        padding: "8px 14px", fontSize: "13px", fontWeight: 600, background: "var(--c-accent)",
        color: "var(--c-on-accent)", border: "none", borderRadius: "8px", cursor: "pointer",
    },
    editCancelBtn: {
        padding: "8px 10px", fontSize: "13px", background: "transparent", color: "var(--c-muted)",
        border: "1px solid var(--c-border2)", borderRadius: "8px", cursor: "pointer",
    },
    detailsSection: { display: "flex", flexDirection: "column" },
    detailRow: {
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "13px 0", borderBottom: "1px solid var(--c-border)", gap: "12px",
    },
    detailRowLast: {
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "13px 0", gap: "12px",
    },
    detailLabel: { fontSize: "13px", color: "var(--c-muted)" },
    detailValue: { fontSize: "14px", fontWeight: 500, textAlign: "right", maxWidth: "220px", wordBreak: "break-word" },
    blockBtn: {
        marginTop: "20px", width: "100%", padding: "12px",
        background: "transparent", color: "#e0717f", border: "1px solid #e0717f",
        borderRadius: "10px", fontSize: "15px", fontWeight: 600, cursor: "pointer",
        transition: "background 0.15s ease",
    },
    unblockBtn: {
        marginTop: "20px", width: "100%", padding: "12px",
        background: "var(--c-accent)", color: "var(--c-on-accent)", border: "none",
        borderRadius: "10px", fontSize: "15px", fontWeight: 600, cursor: "pointer",
        transition: "background 0.15s ease",
    },
};

const css = `
.pulse-back:hover { background: rgba(255,255,255,0.32) !important; }
.pulse-block:hover { background: rgba(224,113,127,0.12); }
.pulse-btn:hover { background: var(--c-accent-hover) !important; }
`;