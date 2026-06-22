import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getUserProfile } from "../api/profileApi";

export default function ViewProfile() {

    const { userId } = useParams();
    const navigate = useNavigate();

    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        getUserProfile(userId)
            .then(setProfile)
            .catch(() => setError("Could not load this profile."))
            .finally(() => setLoading(false));
    }, [userId]);

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
            <div style={styles.card}>

                <button style={styles.backBtn} onClick={() => navigate(-1)}>← Back</button>

                {/* Avatar + Name */}
                <div style={styles.avatarWrapper}>
                    <img
                        src={profile.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name || "U")}&size=96`}
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
                    <div style={styles.detailRow}>
                        <span style={styles.detailLabel}>Member since</span>
                        <span style={styles.detailValue}>
                            {new Date(profile.createdAt).toLocaleDateString()}
                        </span>
                    </div>
                </div>

            </div>
        </div>
    );
}

const styles = {
    center: { display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" },
    container: {
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
    },
    card: {
        display: "flex",
        flexDirection: "column",
        width: "340px",
        padding: "24px",
        border: "1px solid #ddd",
        borderRadius: "8px",
    },
    backBtn: {
        background: "none",
        border: "none",
        cursor: "pointer",
        fontSize: "14px",
        color: "#1a73e8",
        padding: 0,
        marginBottom: "16px",
        textAlign: "left",
    },
    avatarWrapper: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        marginBottom: "24px",
        gap: "8px",
    },
    avatar: {
        width: "90px",
        height: "90px",
        borderRadius: "50%",
        objectFit: "cover",
        border: "1px solid #ddd",
    },
    name: { fontSize: "20px", margin: 0 },
    lastSeen: {
        fontSize: "13px",
        color: "#888",
    },
    detailsSection: { display: "flex", flexDirection: "column" },
    detailRow: {
        display: "flex",
        justifyContent: "space-between",
        padding: "12px 0",
        borderBottom: "1px solid #f0f0f0",
    },
    detailLabel: { fontSize: "13px", color: "#888" },
    detailValue: { fontSize: "14px", fontWeight: "500", textAlign: "right", maxWidth: "200px", wordBreak: "break-word" },
};