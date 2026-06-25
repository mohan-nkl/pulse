import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import HomeButton from "../components/HomeButton";
import { getMyProfile, updateProfile, uploadAvatar, removeAvatar } from "../api/profileApi";

export default function Profile() {

    const { user, updateUser } = useAuth();

    const [profile, setProfile] = useState(null);
    const [name, setName] = useState("");
    const [about, setAbout] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [success, setSuccess] = useState("");
    const [error, setError] = useState("");
    const [editMode, setEditMode] = useState(false);

    const fileInputRef = useRef(null);

    useEffect(() => {
        getMyProfile()
            .then((data) => {
                setProfile(data);
                setName(data.name || "");
                setAbout(data.about || "");
            })
            .catch(() => setError("Failed to load profile."))
            .finally(() => setLoading(false));
    }, []);

    const handleSave = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");
        setSaving(true);
        try {
            const updated = await updateProfile({ name, about });
            setProfile(updated);
            updateUser({ name: updated.name, avatarUrl: updated.avatarUrl });
            setSuccess("Profile updated successfully.");
            setEditMode(false);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to update profile.");
        } finally {
            setSaving(false);
        }
    };

    const handleAvatarChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setError("");
        setSuccess("");
        setUploading(true);
        try {
            const avatarUrl = await uploadAvatar(file);
            setProfile((prev) => ({ ...prev, avatarUrl }));
            updateUser({ avatarUrl });
            setSuccess("Avatar updated.");
        } catch (err) {
            setError(err.response?.data?.message || "Failed to upload avatar.");
        } finally {
            setUploading(false);
        }
    };

    const handleRemoveAvatar = async () => {
        setError("");
        setSuccess("");
        setUploading(true);
        try {
            const updated = await removeAvatar();
            setProfile(updated);
            updateUser({ avatarUrl: null });
            setSuccess("Photo removed.");
        } catch (err) {
            setError(err.response?.data?.message || "Failed to remove photo.");
        } finally {
            setUploading(false);
        }
    };

    const formatDate = (iso) => {
        if (!iso) return "—";
        return new Date(iso).toLocaleString();
    };

    if (loading) return <div style={styles.center}>Loading...</div>;

    return (
        <div style={styles.container}>
            <style>{css}</style>
            <div style={styles.card}>
                <HomeButton style={{ marginBottom: "16px", alignSelf: "flex-start" }} />
                <h1 style={styles.title}>My Profile</h1>

                {error && <div style={styles.error}>{error}</div>}
                {success && <div style={styles.successBox}>{success}</div>}

                {}
                <div style={styles.avatarWrapper}>
                    <img
                        src={profile.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name || "U")}&size=96&background=00a884&color=fff`}
                        alt="avatar"
                        style={styles.avatar}
                    />
                    <button
                        style={styles.avatarBtn}
                        onClick={() => fileInputRef.current.click()}
                        disabled={uploading}
                    >
                        {uploading ? "Uploading..." : "Change photo"}
                    </button>
                    {profile.avatarUrl && (
                        <button
                            style={styles.avatarRemoveBtn}
                            onClick={handleRemoveAvatar}
                            disabled={uploading}
                        >
                            Remove photo
                        </button>
                    )}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        style={{ display: "none" }}
                        onChange={handleAvatarChange}
                    />
                </div>

                {}
                {!editMode && (
                    <div style={styles.detailsSection}>
                        <div style={styles.detailRow}>
                            <span style={styles.detailLabel}>Name</span>
                            <span style={styles.detailValue}>{profile.name || "—"}</span>
                        </div>
                        <div style={styles.detailRow}>
                            <span style={styles.detailLabel}>Phone</span>
                            <span style={styles.detailValue}>{user?.phone || "—"}</span>
                        </div>
                        <div style={styles.detailRow}>
                            <span style={styles.detailLabel}>About</span>
                            <span style={styles.detailValue}>{profile.about || "—"}</span>
                        </div>
                        <div style={styles.detailRow}>
                            <span style={styles.detailLabel}>Last seen</span>
                            <span style={styles.detailValue}>{formatDate(profile.lastSeen)}</span>
                        </div>
                        <div style={styles.detailRowLast}>
                            <span style={styles.detailLabel}>Member since</span>
                            <span style={styles.detailValue}>{formatDate(profile.createdAt)}</span>
                        </div>

                        <button style={styles.primaryBtn} className="pulse-btn" onClick={() => setEditMode(true)}>
                            Edit Profile
                        </button>
                    </div>
                )}

                {}
                {editMode && (
                    <form onSubmit={handleSave} style={styles.detailsSection}>
                        <label style={styles.label}>Name</label>
                        <input
                            style={styles.input}
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Your name"
                            maxLength={100}
                        />

                        <label style={styles.label}>About</label>
                        <input
                            style={styles.input}
                            type="text"
                            value={about}
                            onChange={(e) => setAbout(e.target.value)}
                            placeholder="Hey there! I am using Pulse."
                            maxLength={200}
                        />

                        <div style={styles.buttonRow}>
                            <button
                                type="button"
                                style={styles.cancelBtn}
                                onClick={() => {
                                    setEditMode(false);
                                    setName(profile.name || "");
                                    setAbout(profile.about || "");
                                    setError("");
                                }}
                            >
                                Cancel
                            </button>
                            <button style={styles.saveBtn} className="pulse-btn" type="submit" disabled={saving}>
                                {saving ? "Saving..." : "Save"}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

const styles = {
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
        padding: "28px 24px",
        background: "#111b21",
        border: "1px solid #1f2c33",
        borderRadius: "18px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
        color: "#e9edef",
    },
    title: { fontSize: "22px", fontWeight: 600, margin: "0 0 18px", textAlign: "center" },
    avatarWrapper: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        marginBottom: "22px",
        gap: "10px",
    },
    avatar: {
        width: "92px",
        height: "92px",
        borderRadius: "50%",
        objectFit: "cover",
        border: "2px solid #00a884",
    },
    avatarBtn: {
        fontSize: "13px",
        background: "none",
        border: "none",
        color: "#38d39f",
        cursor: "pointer",
        padding: 0,
        fontWeight: 500,
    },
    avatarRemoveBtn: {
        fontSize: "13px",
        background: "none",
        border: "none",
        color: "#f1707d",
        cursor: "pointer",
        padding: 0,
        fontWeight: 500,
    },
    detailsSection: { display: "flex", flexDirection: "column", gap: "2px" },
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
    label: { fontSize: "13px", color: "#8696a0", marginTop: "10px", marginBottom: "4px" },
    input: {
        padding: "11px 12px",
        fontSize: "14px",
        background: "#0b141a",
        border: "1px solid #2a3942",
        borderRadius: "9px",
        color: "#e9edef",
        boxSizing: "border-box",
        outline: "none",
    },
    primaryBtn: {
        marginTop: "18px",
        padding: "12px",
        fontSize: "15px",
        fontWeight: 600,
        border: "none",
        borderRadius: "10px",
        cursor: "pointer",
        background: "#00a884",
        color: "#0b141a",
    },
    buttonRow: { display: "flex", gap: "10px", marginTop: "18px" },
    cancelBtn: {
        flex: 1,
        padding: "12px",
        fontSize: "14px",
        fontWeight: 500,
        border: "1px solid #2a3942",
        borderRadius: "10px",
        cursor: "pointer",
        background: "transparent",
        color: "#e9edef",
    },
    saveBtn: {
        flex: 1,
        padding: "12px",
        fontSize: "14px",
        fontWeight: 600,
        border: "none",
        borderRadius: "10px",
        cursor: "pointer",
        background: "#00a884",
        color: "#0b141a",
    },
    error: {
        background: "rgba(241,92,109,0.12)",
        color: "#f7919c",
        padding: "10px 12px",
        borderRadius: "9px",
        fontSize: "13.5px",
        marginBottom: "12px",
    },
    successBox: {
        background: "rgba(0,168,132,0.14)",
        color: "#38d39f",
        padding: "10px 12px",
        borderRadius: "9px",
        fontSize: "13.5px",
        marginBottom: "12px",
    },
};

const css = `
.pulse-btn:hover { background: #06cf7f !important; }
.pulse-btn:disabled { opacity: 0.6; cursor: default; }
input::placeholder { color: #5b6b74; }
`;
