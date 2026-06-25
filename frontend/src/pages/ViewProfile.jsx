import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getUserProfile } from "../api/profileApi";
import { blockUser, unblockUser, getBlockStatus } from "../api/blockApi";

export default function ViewProfile() {

    const { userId } = useParams();
    const navigate = useNavigate();

    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [isBlocked, setIsBlocked] = useState(false);
    const [working, setWorking] = useState(false);

    useEffect(() => {
        getUserProfile(userId)
            .then(setProfile)
            .catch(() => setError("Could not load this profile."))
            .finally(() => setLoading(false));

        getBlockStatus(userId)
            .then((r) => setIsBlocked(!!r.blocked))
            .catch(() => setIsBlocked(false));
    }, [userId]);

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
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return "just now";
        if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
        if (diffDays === 1) return "yesterday";
        if (diffDays < 7) return `${diffDays} days ago`;
        return date.toLocaleDateString();
    };

    if (loading) return <div style={styles.center}>Loading...</div>;
    if (error) return <div style={styles.center}>{error}</div>;

    return (
        <div style={styles.container}>
            <style>{css}</style>
            <div style={styles.card}>

                <button style={styles.backBtn} className="pulse-back" onClick={() => navigate(-1)}>← Back</button>

                {/* Avatar + Name */}
                <div style={styles.avatarWrapper}>
                    <img
                        src={profile.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name || "U")}&size=96&background=00a884&color=fff`}
                        alt="avatar"
                        style={styles.avatar}
                    />
                    <h2 style={styles.name}>{profile.name || "Unknown"}</h2>

                    {/* Last seen */}
                    <span style={styles.lastSeen}>
                        Last seen {formatLastSeen(profile.lastSeen)}
                    </span>
                </div>

                {/* Details */}
                <div style={styles.detailsSection}>
                    {profile.about && (
                        <div style={styles.detailRow}>
                            <span style={styles.detailLabel}>About</span>
                            <span style={styles.detailValue}>{profile.about}</span>
                        </div>
                    )}
                    <div style={styles.detailRowLast}>
                        <span style={styles.detailLabel}>Member since</span>
                        <span style={styles.detailValue}>
                            {new Date(profile.createdAt).toLocaleDateString()}
                        </span>
                    </div>
                </div>

                <button
                    style={isBlocked ? styles.unblockBtn : styles.blockBtn}
                    onClick={toggleBlock}
                    disabled={working}
                >
                    {working ? "..." : isBlocked ? "Unblock" : "Block"}
                </button>

            </div>
        </div>
    );
}

const styles = {
    blockBtn: {
        marginTop: "20px",
        width: "100%",
        padding: "12px",
        background: "transparent",
        color: "#f15c6d",
        border: "1px solid #f15c6d",
        borderRadius: "8px",
        fontSize: "15px",
        fontWeight: 600,
        cursor: "pointer",
    },
    unblockBtn: {
        marginTop: "20px",
        width: "100%",
        padding: "12px",
        background: "#00a884",
        color: "#fff",
        border: "none",
        borderRadius: "8px",
        fontSize: "15px",
        fontWeight: 600,
        cursor: "pointer",
    },
    center: {
        display: "flex", justifyContent: "center", alignItems: "center",
        minHeight: "100vh", background: "#0b141a", color: "#e9edef",
    },
    container: {
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        padding: "24px",
        boxSizing: "border-box",
        background:
            "radial-gradient(1200px 500px at 50% -10%, rgba(0,168,132,0.10), transparent 60%), #0b141a",
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
    card: {
        display: "flex",
        flexDirection: "column",
        width: "360px",
        maxWidth: "100%",
        padding: "24px",
        background: "#111b21",
        border: "1px solid #1f2c33",
        borderRadius: "18px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
        color: "#e9edef",
    },
    backBtn: {
        background: "none",
        border: "none",
        cursor: "pointer",
        fontSize: "14px",
        color: "#38d39f",
        padding: 0,
        marginBottom: "16px",
        textAlign: "left",
        alignSelf: "flex-start",
        fontWeight: 500,
    },
    avatarWrapper: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        marginBottom: "22px",
        gap: "8px",
    },
    avatar: {
        width: "96px",
        height: "96px",
        borderRadius: "50%",
        objectFit: "cover",
        border: "2px solid #00a884",
    },
    name: { fontSize: "21px", fontWeight: 600, margin: "6px 0 0" },
    lastSeen: {
        fontSize: "13px",
        color: "#8696a0",
    },
    detailsSection: { display: "flex", flexDirection: "column" },
    detailRow: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "13px 0",
        borderBottom: "1px solid #1f2c33",
        gap: "12px",
    },
    detailRowLast: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "13px 0",
        gap: "12px",
    },
    detailLabel: { fontSize: "13px", color: "#8696a0" },
    detailValue: { fontSize: "14px", fontWeight: 500, textAlign: "right", maxWidth: "220px", wordBreak: "break-word" },
};

const css = `
.pulse-back:hover { color: #06cf7f !important; }
`;