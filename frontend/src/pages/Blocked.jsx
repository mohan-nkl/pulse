import { useState, useEffect } from "react";
import { listBlocked, unblockUser } from "../api/blockApi";

export default function Blocked() {
    const [blocked, setBlocked] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        listBlocked()
            .then((data) => setBlocked(data || []))
            .catch(() => setError("Could not load blocked contacts."))
            .finally(() => setLoading(false));
    }, []);

    const handleUnblock = async (userId) => {
        try {
            await unblockUser(userId);
            setBlocked((prev) => prev.filter((b) => b.userId !== userId));
            setError("");
        } catch {
            setError("Could not unblock. Please try again.");
        }
    };

    const avatarSrc = (b) => {
        if (b.avatarUrl) return b.avatarUrl;
        const label = b.name || b.phone || "U";
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(label)}&size=80&background=2c6b5b&color=fff`;
    };

    return (
        <div style={styles.page}>
            <style>{css}</style>
            <div style={styles.card}>
                <div style={styles.header}>
                    <h1 style={styles.title}>Blocked contacts</h1>
                </div>

                {error && <div style={styles.error}>{error}</div>}

                {loading ? (
                    <div style={styles.center}>Loading…</div>
                ) : blocked.length === 0 ? (
                    <div style={styles.empty}>No blocked contacts.</div>
                ) : (
                    <div style={styles.list}>
                        {blocked.map((b) => (
                            <div key={b.userId} style={styles.row}>
                                <img src={avatarSrc(b)} alt="" style={styles.avatar} />
                                <div style={styles.info}>
                                    <span style={styles.name}>{b.name || b.phone || "Unknown"}</span>
                                </div>
                                <button
                                    style={styles.unblockBtn}
                                    className="pulse-btn"
                                    onClick={() => handleUnblock(b.userId)}
                                >
                                    Unblock
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

const styles = {
    page: {
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        minHeight: "100vh",
        padding: "32px 20px",
        boxSizing: "border-box",
        background: "var(--c-bg)",
    },
    card: {
        width: "440px",
        maxWidth: "100%",
        background: "var(--c-panel)",
        border: "1px solid var(--c-border)",
        borderRadius: "16px",
        padding: "22px",
        boxShadow: "var(--c-shadow)",
        color: "var(--c-text)",
    },
    header: { display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" },
    title: { fontSize: "20px", fontWeight: 600, margin: 0 },
    list: { display: "flex", flexDirection: "column", gap: "4px" },
    row: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "10px 8px",
        borderRadius: "12px",
    },
    avatar: { width: "42px", height: "42px", borderRadius: "50%", objectFit: "cover", flex: "0 0 auto" },
    info: { display: "flex", flexDirection: "column", flex: 1, minWidth: 0 },
    name: { fontSize: "15px", fontWeight: 600, color: "var(--c-text)" },
    unblockBtn: {
        flex: "0 0 auto",
        padding: "7px 16px",
        fontSize: "13px",
        fontWeight: 600,
        border: "none",
        borderRadius: "9px",
        cursor: "pointer",
        background: "var(--c-accent)",
        color: "var(--c-on-accent)",
    },
    center: { textAlign: "center", color: "var(--c-muted)", padding: "28px 0" },
    empty: { textAlign: "center", color: "var(--c-muted)", padding: "28px 0", fontSize: "14px" },
    error: {
        background: "rgba(224,113,127,0.12)",
        color: "#e0717f",
        padding: "10px 12px",
        borderRadius: "9px",
        fontSize: "13.5px",
        marginBottom: "12px",
    },
};

const css = `
.pulse-btn:hover { background: var(--c-accent-hover) !important; }
`;