import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
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
                <div style={styles.cover} />
                <div style={styles.body}>
                <div style={styles.hero}>
                    <div style={styles.avatarRing}>
                        <img
                            src={profile.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name || "U")}&size=120&background=2c6b5b&color=fff`}
                            alt="avatar"
                            style={styles.avatar}
                        />
                    </div>
                    {!editMode && <h1 style={styles.heroName}>{profile.name || "—"}</h1>}
                    {!editMode && <p style={styles.heroAbout}>{profile.about || "Hey there! I am using Pulse."}</p>}
                    <div style={styles.photoBtns}>
                        <button style={styles.avatarBtn} onClick={() => fileInputRef.current.click()} disabled={uploading}>
                            {uploading ? "Uploading…" : "Change photo"}
                        </button>
                        {profile.avatarUrl && (
                            <button style={styles.avatarRemoveBtn} onClick={handleRemoveAvatar} disabled={uploading}>
                                Remove
                            </button>
                        )}
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        style={{ display: "none" }}
                        onChange={handleAvatarChange}
                    />
                </div>

                {error && <div style={styles.error}>{error}</div>}
                {success && <div style={styles.successBox}>{success}</div>}

                {!editMode && (
                    <div style={styles.detailsSection}>
                        <div style={styles.detailRow}>
                            <span style={styles.detailLabel}>Phone</span>
                            <span style={styles.detailValue}>{user?.phone || "—"}</span>
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
                            className="pulse-pinput" style={styles.input}
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Your name"
                            maxLength={100}
                        />

                        <label style={styles.label}>About</label>
                        <input
                            className="pulse-pinput" style={styles.input}
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
        background:
            "radial-gradient(1200px 500px at 50% -10%, rgba(74,157,137,0.10), transparent 60%), var(--c-bg)",
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
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
        background:
            "radial-gradient(420px 200px at 80% 0%, rgba(255,255,255,0.16), transparent 60%), linear-gradient(135deg, var(--c-accent), var(--c-accent-hover))",
    },
    body: { padding: "0 28px 28px" },
    hero: { display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "22px" },
    avatarRing: {
        marginTop: "-56px",
        padding: "5px",
        borderRadius: "50%",
        background: "var(--c-panel)",
        boxShadow: "0 6px 20px rgba(0,0,0,0.20)",
    },
    avatar: {
        width: "104px",
        height: "104px",
        borderRadius: "50%",
        objectFit: "cover",
        display: "block",
    },
    heroName: { fontSize: "22px", fontWeight: 600, color: "var(--c-text)", margin: "14px 0 0" },
    heroAbout: { fontSize: "13.5px", color: "var(--c-muted)", margin: "4px 0 0", textAlign: "center", maxWidth: "280px" },
    photoBtns: { display: "flex", gap: "16px", marginTop: "12px" },
    avatarBtn: {
        fontSize: "13px",
        background: "none",
        border: "none",
        color: "var(--c-accent)",
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
        borderBottom: "1px solid var(--c-border)",
        gap: "12px",
    },
    detailRowLast: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "13px 0",
        gap: "12px",
    },
    detailLabel: { fontSize: "13px", color: "var(--c-muted)" },
    detailValue: { fontSize: "14px", fontWeight: 500, textAlign: "right", maxWidth: "220px", wordBreak: "break-word" },
    label: { fontSize: "13px", color: "var(--c-muted)", marginTop: "10px", marginBottom: "4px" },
    input: {
        padding: "11px 12px",
        fontSize: "14px",
        background: "var(--c-bg)",
        border: "1px solid var(--c-border2)",
        borderRadius: "9px",
        color: "var(--c-text)",
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
        background: "var(--c-accent)",
        color: "var(--c-on-accent)",
    },
    buttonRow: { display: "flex", gap: "10px", marginTop: "18px" },
    cancelBtn: {
        flex: 1,
        padding: "12px",
        fontSize: "14px",
        fontWeight: 500,
        border: "1px solid var(--c-border2)",
        borderRadius: "10px",
        cursor: "pointer",
        background: "transparent",
        color: "var(--c-text)",
    },
    saveBtn: {
        flex: 1,
        padding: "12px",
        fontSize: "14px",
        fontWeight: 600,
        border: "none",
        borderRadius: "10px",
        cursor: "pointer",
        background: "var(--c-accent)",
        color: "var(--c-on-accent)",
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
        background: "rgba(74,157,137,0.14)",
        color: "var(--c-accent)",
        padding: "10px 12px",
        borderRadius: "9px",
        fontSize: "13.5px",
        marginBottom: "12px",
    },
};

const css = `
.pulse-btn:hover { background: var(--c-accent-hover) !important; }
.pulse-btn:disabled { opacity: 0.6; cursor: default; }
.pulse-pinput:focus { border-color: var(--c-accent); box-shadow: 0 0 0 3px rgba(74,157,137,0.18); }
input::placeholder { color: var(--c-muted2); }
`;
