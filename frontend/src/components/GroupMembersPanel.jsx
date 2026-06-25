import { useEffect, useRef, useState } from "react";
import {
    getGroupMembers,
    addGroupMembers,
    removeGroupMember,
    makeGroupAdmin,
    dismissGroupAdmin,
    leaveGroup,
    updateGroup,
    uploadGroupAvatar,
} from "../api/groupApi";

export default function GroupMembersPanel({ group, contacts, currentUserId, onClose, onLeft, onUpdated }) {
    const [members, setMembers] = useState([]);
    const [adding, setAdding] = useState(false);
    const [selectedToAdd, setSelectedToAdd] = useState([]);
    const [error, setError] = useState("");

    const [name, setName] = useState(group.name);
    const [savingName, setSavingName] = useState(false);
    const [savingAvatar, setSavingAvatar] = useState(false);
    const avatarInputRef = useRef(null);

    const isAdmin = group.myRole === "ADMIN";

    useEffect(() => {
        loadMembers();
        setAdding(false);
        setSelectedToAdd([]);
        setName(group.name);
    }, [group.id]);

    const loadMembers = async () => {
        try {
            setMembers(await getGroupMembers(group.id));
            setError("");
        } catch (err) {
            setError(err.response?.data?.message || "Could not load members.");
        }
    };

    const memberIds = members.map((m) => m.userId);
    const addable = contacts.filter((c) => !memberIds.includes(c.userId));

    const toggleAdd = (userId) => {
        setSelectedToAdd((prev) =>
            prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
        );
    };

    const handleAdd = async () => {
        if (selectedToAdd.length === 0) return;
        try {
            setMembers(await addGroupMembers(group.id, selectedToAdd));
            setSelectedToAdd([]);
            setAdding(false);
        } catch (err) {
            setError(err.response?.data?.message || "Could not add members.");
        }
    };

    const handleRemove = async (userId) => {
        try {
            setMembers(await removeGroupMember(group.id, userId));
        } catch (err) {
            setError(err.response?.data?.message || "Could not remove member.");
        }
    };

    const handlePromote = async (userId) => {
        try {
            setMembers(await makeGroupAdmin(group.id, userId));
        } catch (err) {
            setError(err.response?.data?.message || "Could not promote member.");
        }
    };

    const handleDemote = async (userId) => {
        try {
            setMembers(await dismissGroupAdmin(group.id, userId));
        } catch (err) {
            setError(err.response?.data?.message || "Could not dismiss admin.");
        }
    };

    const handleLeave = async () => {
        try {
            await leaveGroup(group.id);
            onLeft();
        } catch (err) {
            setError(err.response?.data?.message || "Could not leave the group.");
        }
    };

    const handleSaveName = async () => {
        const trimmed = name.trim();
        if (!trimmed || savingName) return;
        setSavingName(true);
        try {
            const updated = await updateGroup(group.id, trimmed);
            onUpdated?.(updated);
            setError("");
        } catch (err) {
            setError(err.response?.data?.message || "Could not rename the group.");
        } finally {
            setSavingName(false);
        }
    };

    const handleAvatar = async (event) => {
        const file = event.target.files[0];
        event.target.value = "";
        if (!file) return;
        setSavingAvatar(true);
        try {
            const updated = await uploadGroupAvatar(group.id, file);
            onUpdated?.(updated);
            setError("");
        } catch (err) {
            setError(err.response?.data?.message || "Could not update the group photo.");
        } finally {
            setSavingAvatar(false);
        }
    };

    return (
        <aside style={styles.panel}>
            <div style={styles.header}>
                <span style={styles.title}>{group.name}</span>
                <button style={styles.close} onClick={onClose}>✕</button>
            </div>

            {error && <div style={styles.error}>{error}</div>}

            {isAdmin && (
                <div style={styles.editSection}>
                    <div style={styles.editAvatarRow}>
                        {group.avatarUrl ? (
                            <img src={group.avatarUrl} alt="" style={styles.editAvatar} />
                        ) : (
                            <div style={styles.editAvatarFallback}>#</div>
                        )}
                        <button
                            style={styles.smallBtn}
                            onClick={() => avatarInputRef.current.click()}
                            disabled={savingAvatar}
                        >
                            {savingAvatar ? "Uploading…" : "Change photo"}
                        </button>
                        <input
                            ref={avatarInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            style={{ display: "none" }}
                            onChange={handleAvatar}
                        />
                    </div>
                    <div style={styles.editNameRow}>
                        <input
                            style={styles.nameInput}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Group name"
                        />
                        <button style={styles.create} onClick={handleSaveName} disabled={savingName}>
                            {savingName ? "…" : "Save"}
                        </button>
                    </div>
                </div>
            )}

            <div style={styles.members}>
                {members.map((member) => {
                    const isMe = member.userId === currentUserId;
                    return (
                        <div key={member.userId} style={styles.memberRow}>
              <span>
                {member.name || "Unknown"}{isMe ? " (you)" : ""}
                  {member.role === "ADMIN" && <span style={styles.badge}>admin</span>}
              </span>

                            {isAdmin && !isMe && (
                                <span style={styles.memberActions}>
                                    {member.role === "ADMIN" ? (
                                        <button style={styles.smallBtn} onClick={() => handleDemote(member.userId)}>
                                            Dismiss admin
                                        </button>
                                    ) : (
                                        <button style={styles.smallBtn} onClick={() => handlePromote(member.userId)}>
                                            Make admin
                                        </button>
                                    )}
                                    <button style={styles.removeBtn} onClick={() => handleRemove(member.userId)}>
                                        Remove
                                    </button>
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>

            {isAdmin && (
                <div style={styles.addSection}>
                    {!adding ? (
                        <button style={styles.addToggle} onClick={() => setAdding(true)}>
                            + Add members
                        </button>
                    ) : (
                        <>
                            <div style={styles.list}>
                                {addable.length === 0 && <p style={styles.empty}>No contacts to add.</p>}
                                {addable.map((contact) => (
                                    <label key={contact.userId} style={styles.row}>
                                        <input
                                            type="checkbox"
                                            checked={selectedToAdd.includes(contact.userId)}
                                            onChange={() => toggleAdd(contact.userId)}
                                        />
                                        <span>{contact.name || "Unknown"}</span>
                                    </label>
                                ))}
                            </div>
                            <div style={styles.actions}>
                                <button
                                    style={styles.cancel}
                                    onClick={() => { setAdding(false); setSelectedToAdd([]); }}
                                >
                                    Cancel
                                </button>
                                <button style={styles.create} onClick={handleAdd}>
                                    Add
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}

            <button style={styles.leave} onClick={handleLeave}>
                Leave group
            </button>
        </aside>
    );
}

const styles = {
    panel: {
        width: "300px",
        borderLeft: "1px solid #222d34",
        background: "#111b21",
        color: "#e9edef",
        display: "flex",
        flexDirection: "column",
        padding: "14px",
        overflowY: "auto",
    },
    header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" },
    title: { fontSize: "16px", fontWeight: 600 },
    close: { background: "transparent", border: "none", color: "#8696a0", fontSize: "16px", cursor: "pointer" },
    editSection: {
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        padding: "10px",
        marginBottom: "12px",
        borderRadius: "6px",
        background: "#202c33",
    },
    editAvatarRow: { display: "flex", alignItems: "center", gap: "10px" },
    editAvatar: { width: "44px", height: "44px", borderRadius: "50%", objectFit: "cover", flex: "0 0 auto" },
    editAvatarFallback: {
        width: "44px",
        height: "44px",
        borderRadius: "50%",
        background: "#2a3942",
        color: "#e9edef",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "18px",
        flex: "0 0 auto",
    },
    editNameRow: { display: "flex", gap: "8px" },
    nameInput: {
        flex: 1,
        minWidth: 0,
        padding: "7px 10px",
        border: "1px solid #2a3942",
        borderRadius: "6px",
        background: "#2a3942",
        color: "#e9edef",
        outline: "none",
        fontSize: "14px",
    },
    members: { display: "flex", flexDirection: "column", gap: "6px" },
    memberRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 6px",
        borderRadius: "6px",
        background: "#202c33",
        fontSize: "14px",
    },
    badge: {
        marginLeft: "8px",
        fontSize: "11px",
        color: "#00a884",
        border: "1px solid #00a884",
        borderRadius: "4px",
        padding: "1px 5px",
    },
    memberActions: { display: "flex", gap: "6px" },
    smallBtn: {
        fontSize: "12px",
        padding: "4px 8px",
        border: "1px solid #2a3942",
        borderRadius: "5px",
        background: "transparent",
        color: "#e9edef",
        cursor: "pointer",
    },
    removeBtn: {
        fontSize: "12px",
        padding: "4px 8px",
        border: "none",
        borderRadius: "5px",
        background: "#5a2a2a",
        color: "#f3c4c4",
        cursor: "pointer",
    },
    addSection: { marginTop: "14px" },
    addToggle: {
        width: "100%",
        padding: "8px",
        border: "1px dashed #2a3942",
        borderRadius: "6px",
        background: "transparent",
        color: "#00a884",
        cursor: "pointer",
    },
    list: {
        maxHeight: "160px",
        overflowY: "auto",
        border: "1px solid #222d34",
        borderRadius: "6px",
        padding: "6px",
        marginBottom: "8px",
    },
    row: { display: "flex", alignItems: "center", gap: "8px", padding: "6px 4px", fontSize: "14px", cursor: "pointer" },
    empty: { fontSize: "13px", color: "#8696a0", padding: "6px 4px" },
    actions: { display: "flex", justifyContent: "flex-end", gap: "8px" },
    cancel: {
        padding: "7px 12px",
        border: "1px solid #2a3942",
        borderRadius: "6px",
        background: "transparent",
        color: "#e9edef",
        cursor: "pointer",
    },
    create: {
        padding: "7px 14px",
        border: "none",
        borderRadius: "6px",
        background: "#00a884",
        color: "#fff",
        cursor: "pointer",
    },
    leave: {
        marginTop: "auto",
        padding: "10px",
        border: "none",
        borderRadius: "6px",
        background: "#5a2a2a",
        color: "#f3c4c4",
        cursor: "pointer",
    },
    error: {
        background: "#3a1e1e",
        color: "#f3a3a3",
        padding: "8px 10px",
        borderRadius: "6px",
        fontSize: "13px",
        marginBottom: "10px",
    },
};
