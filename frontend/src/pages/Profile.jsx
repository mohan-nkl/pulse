import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { getMyProfile, updateProfile, uploadAvatar } from "../api/profileApi";

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

    const formatDate = (iso) => {
        if (!iso) return "—";
        return new Date(iso).toLocaleString();
    };

    if (loading) return <div style={styles.center}>Loading...</div>;

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <h1 style={styles.title}>My Profile</h1>

                {error && <div style={styles.error}>{error}</div>}
                {success && <div style={styles.successBox}>{success}</div>}

                {/* Avatar */}
                <div style={styles.avatarWrapper}>
                    <img
                        src={profile.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name || "U")}&size=96`}
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
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        style={{ display: "none" }}
                        onChange={handleAvatarChange}
                    />
                </div>

                {/* ── User Details (read-only view) ── */}
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
                        <div style={styles.detailRow}>
                            <span style={styles.detailLabel}>Member since</span>
                            <span style={styles.detailValue}>{formatDate(profile.createdAt)}</span>
                        </div>

                        <button style={styles.button} onClick={() => setEditMode(true)}>
                            Edit Profile
                        </button>
                    </div>
                )}

                {/* ── Edit Form ── */}
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
                            <button style={styles.saveBtn} type="submit" disabled={saving}>
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
    title: { fontSize: "20px", marginBottom: "16px", textAlign: "center" },
    avatarWrapper: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        marginBottom: "20px",
        gap: "8px",
    },
    avatar: {
        width: "80px",
        height: "80px",
        borderRadius: "50%",
        objectFit: "cover",
        border: "1px solid #ddd",
    },
    avatarBtn: {
        fontSize: "13px",
        background: "none",
        border: "none",
        color: "#1a73e8",
        cursor: "pointer",
        padding: 0,
    },
    detailsSection: { display: "flex", flexDirection: "column", gap: "10px" },
    detailRow: {
        display: "flex",
        justifyContent: "space-between",
        padding: "10px 0",
        borderBottom: "1px solid #f0f0f0",
    },
    detailLabel: { fontSize: "13px", color: "#888" },
    detailValue: { fontSize: "14px", fontWeight: "500", textAlign: "right", maxWidth: "200px", wordBreak: "break-word" },
    label: { fontSize: "14px", color: "#555" },
    input: {
        padding: "10px",
        fontSize: "14px",
        border: "1px solid #ccc",
        borderRadius: "6px",
        boxSizing: "border-box",
    },
    button: {
        marginTop: "8px",
        padding: "10px",
        fontSize: "15px",
        border: "none",
        borderRadius: "6px",
        cursor: "pointer",
    },
    buttonRow: { display: "flex", gap: "10px", marginTop: "8px" },
    cancelBtn: {
        flex: 1,
        padding: "10px",
        fontSize: "14px",
        border: "1px solid #ccc",
        borderRadius: "6px",
        cursor: "pointer",
        background: "#fff",
    },
    saveBtn: {
        flex: 1,
        padding: "10px",
        fontSize: "14px",
        border: "none",
        borderRadius: "6px",
        cursor: "pointer",
    },
    error: {
        background: "#fdecea",
        color: "#b71c1c",
        padding: "10px",
        borderRadius: "6px",
        fontSize: "14px",
    },
    successBox: {
        background: "#e8f5e9",
        color: "#2e7d32",
        padding: "10px",
        borderRadius: "6px",
        fontSize: "14px",
    },
};