import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import HomeButton from "../components/HomeButton";
import {
    listContacts, searchContacts, addContact, addContactByUserId,
    removeContact, updateAlias, syncPhones,
} from "../api/contactApi";

export default function Contacts() {
    const navigate = useNavigate();

    const [contacts, setContacts] = useState([]);
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // Add modal
    const [showAdd, setShowAdd] = useState(false);
    const [addPhone, setAddPhone] = useState("");
    const [addAlias, setAddAlias] = useState("");
    const [addLoading, setAddLoading] = useState(false);
    const [addError, setAddError] = useState("");

    // Edit alias inline
    const [editingId, setEditingId] = useState(null);
    const [editAlias, setEditAlias] = useState("");
    const [editLoading, setEditLoading] = useState(false);

    // Sync panel
    const isFirstRender = useRef(true);

    const [showSync, setShowSync] = useState(false);
    const [syncInput, setSyncInput] = useState("");
    const [syncResults, setSyncResults] = useState([]);
    const [syncLoading, setSyncLoading] = useState(false);
    const [syncError, setSyncError] = useState("");

    const load = useCallback(async (q = "") => {
        setLoading(true);
        try {
            const data = q.trim() ? await searchContacts(q.trim()) : await listContacts();
            setContacts(data);
        } catch {
            setError("Failed to load contacts.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        const t = setTimeout(() => load(query), 300);
        return () => clearTimeout(t);
    }, [query, load]);

    const flash = (msg) => {
        setSuccess(msg);
        setTimeout(() => setSuccess(""), 3000);
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        setAddError("");
        setAddLoading(true);
        try {
            const newContact = await addContact({ phone: addPhone.trim(), alias: addAlias.trim() || undefined });
            setContacts((prev) => [newContact, ...prev]);
            setShowAdd(false);
            setAddPhone("");
            setAddAlias("");
            flash("Contact added.");
        } catch (err) {
            setAddError(err.response?.data?.message || "Failed to add contact.");
        } finally {
            setAddLoading(false);
        }
    };

    const handleRemove = async (id) => {
        if (!window.confirm("Remove this contact?")) return;
        setError("");
        try {
            await removeContact(id);
            setContacts((prev) => prev.filter((c) => c.id !== id));
            flash("Contact removed.");
        } catch {
            setError("Failed to remove contact.");
        }
    };

    const startEdit = (contact) => {
        setEditingId(contact.id);
        setEditAlias(contact.alias || "");
    };

    const handleEditSave = async (id) => {
        setError("");
        setEditLoading(true);
        try {
            const updated = await updateAlias(id, editAlias.trim() || null);
            setContacts((prev) => prev.map((c) => (c.id === id ? updated : c)));
            setEditingId(null);
            flash("Alias updated.");
        } catch {
            setError("Failed to update alias.");
        } finally {
            setEditLoading(false);
        }
    };

    const handleSync = async () => {
        setSyncError("");
        setSyncResults([]);
        setSyncLoading(true);
        const phones = syncInput.split(/[\n,]+/).map((p) => p.trim()).filter(Boolean);
        if (!phones.length) {
            setSyncError("Enter at least one phone number.");
            setSyncLoading(false);
            return;
        }
        try {
            const results = await syncPhones(phones);
            setSyncResults(results);
            if (!results.length) setSyncError("No Pulse users found for those numbers.");
        } catch {
            setSyncError("Sync failed. Please try again.");
        } finally {
            setSyncLoading(false);
        }
    };

    const handleAddFromSync = async (user) => {
        setError("");
        try {
            const newContact = await addContactByUserId(user.userId);
            setContacts((prev) => [newContact, ...prev]);
            setSyncResults((prev) =>
                prev.map((u) =>
                    u.userId === user.userId
                        ? { ...u, alreadyContact: true, contactRecordId: newContact.id }
                        : u
                )
            );
            flash("Contact added.");
        } catch (err) {
            setError(err.response?.data?.message || "Failed to add contact.");
        }
    };

    const handleRemoveFromSync = async (user) => {
        setError("");
        try {
            await removeContact(user.contactRecordId);
            setContacts((prev) => prev.filter((c) => c.id !== user.contactRecordId));
            setSyncResults((prev) =>
                prev.map((u) =>
                    u.userId === user.userId
                        ? { ...u, alreadyContact: false, contactRecordId: null }
                        : u
                )
            );
            flash("Contact removed.");
        } catch {
            setError("Failed to remove contact.");
        }
    };

    const formatLastSeen = (iso) => {
        if (!iso) return "Never seen";
        const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
        if (diff < 60) return "Just now";
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return new Date(iso).toLocaleDateString();
    };

    const displayName = (c) => c.alias || c.name || "Unknown";
    const avatarSrc = (name, url) =>
        url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "U")}&size=40`;

    return (
        <div style={styles.page}>
            <div style={styles.card}>

                {/* Header */}
                <div style={styles.header}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <HomeButton />
                        <h1 style={styles.title}>Contacts</h1>
                    </div>
                    <div style={styles.headerBtns}>
                        <button
                            style={styles.secondaryBtn}
                            onClick={() => { setShowSync(!showSync); setSyncResults([]); setSyncError(""); }}
                        >
                            {showSync ? "Hide Sync" : "Sync"}
                        </button>
                        <button style={styles.primaryBtn} onClick={() => { setShowAdd(true); setAddError(""); }}>
                            + Add
                        </button>
                    </div>
                </div>

                {error && <div style={styles.error}>{error}</div>}
                {success && <div style={styles.successBox}>{success}</div>}

                {/* Search */}
                <input
                    style={styles.search}
                    type="text"
                    placeholder="Search by name, alias or phone..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />

                {/* Contact List */}
                {loading ? (
                    <div style={styles.center}>Loading...</div>
                ) : contacts.length === 0 ? (
                    <div style={styles.empty}>No contacts yet. Add one!</div>
                ) : (
                    <div style={styles.list}>
                        {contacts.map((c) => (
                            <div key={c.id} style={styles.contactRow}>
                                <img
                                    src={avatarSrc(c.name, c.avatarUrl)}
                                    alt=""
                                    style={styles.avatar}
                                    onClick={() => navigate(`/users/${c.contactId}/profile`)}
                                />
                                <div style={styles.contactInfo}>
                                    {editingId === c.id ? (
                                        <div style={styles.editRow}>
                                            <input
                                                style={styles.editInput}
                                                value={editAlias}
                                                onChange={(e) => setEditAlias(e.target.value)}
                                                placeholder="Nickname (leave empty to clear)"
                                                autoFocus
                                            />
                                            <button
                                                style={styles.saveBtn}
                                                onClick={() => handleEditSave(c.id)}
                                                disabled={editLoading}
                                            >
                                                {editLoading ? "..." : "Save"}
                                            </button>
                                            <button style={styles.cancelBtn} onClick={() => setEditingId(null)}>
                                                ✕
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <span style={styles.contactName}>{displayName(c)}</span>
                                            {c.alias && <span style={styles.realName}>{c.name}</span>}
                                        </>
                                    )}
                                    <span style={styles.lastSeen}>{formatLastSeen(c.lastSeen)}</span>
                                </div>
                                {editingId !== c.id && (
                                    <div style={styles.actions}>
                                        <button style={styles.actionBtn} onClick={() => startEdit(c)} title="Edit alias">✏️</button>
                                        <button style={styles.actionBtn} onClick={() => handleRemove(c.id)} title="Remove">🗑️</button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Sync Panel */}
                {showSync && (
                    <div style={styles.syncPanel}>
                        <p style={styles.syncTitle}>Find people on Pulse</p>
                        <p style={styles.syncHint}>Enter phone numbers (one per line or comma-separated)</p>
                        <textarea
                            style={styles.textarea}
                            rows={4}
                            placeholder={"+919999999999\n+918888888888"}
                            value={syncInput}
                            onChange={(e) => setSyncInput(e.target.value)}
                        />
                        <button style={styles.primaryBtn} onClick={handleSync} disabled={syncLoading}>
                            {syncLoading ? "Searching..." : "Find on Pulse"}
                        </button>
                        {syncError && <div style={styles.error}>{syncError}</div>}
                        {syncResults.map((u) => (
                            <div key={u.userId} style={styles.syncRow}>
                                <img src={avatarSrc(u.name, u.avatarUrl)} alt="" style={styles.avatar} />
                                <span style={styles.contactName}>{u.name || "Pulse User"}</span>
                                {u.alreadyContact ? (
                                    <button style={styles.removeBtn} onClick={() => handleRemoveFromSync(u)}>
                                        Remove
                                    </button>
                                ) : (
                                    <button style={styles.addBtn} onClick={() => handleAddFromSync(u)}>
                                        Add
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Add Contact Modal */}
            {showAdd && (
                <div style={styles.overlay} onClick={() => setShowAdd(false)}>
                    <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <h2 style={styles.modalTitle}>Add Contact</h2>
                        {addError && <div style={styles.error}>{addError}</div>}
                        <form onSubmit={handleAdd} style={styles.form}>
                            <label style={styles.label}>Phone number</label>
                            <input
                                style={styles.input}
                                type="text"
                                placeholder="+919999999999"
                                value={addPhone}
                                onChange={(e) => setAddPhone(e.target.value)}
                                autoFocus
                            />
                            <label style={styles.label}>Nickname (optional)</label>
                            <input
                                style={styles.input}
                                type="text"
                                placeholder="e.g. Mom"
                                value={addAlias}
                                onChange={(e) => setAddAlias(e.target.value)}
                            />
                            <div style={styles.modalBtns}>
                                <button type="button" style={styles.cancelBtn} onClick={() => setShowAdd(false)}>
                                    Cancel
                                </button>
                                <button type="submit" style={styles.primaryBtn} disabled={addLoading}>
                                    {addLoading ? "Adding..." : "Add"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

const styles = {
    page: { display: "flex", justifyContent: "center", alignItems: "flex-start", minHeight: "100vh", padding: "40px 16px" },
    card: { width: "100%", maxWidth: "480px", border: "1px solid #ddd", borderRadius: "8px", padding: "24px", display: "flex", flexDirection: "column", gap: "14px" },
    header: { display: "flex", justifyContent: "space-between", alignItems: "center" },
    title: { fontSize: "20px", margin: 0 },
    headerBtns: { display: "flex", gap: "8px" },
    primaryBtn: { padding: "8px 14px", fontSize: "14px", background: "#1a73e8", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" },
    secondaryBtn: { padding: "8px 14px", fontSize: "14px", background: "#f1f3f4", color: "#444", border: "none", borderRadius: "6px", cursor: "pointer" },
    search: { padding: "10px", fontSize: "14px", border: "1px solid #ccc", borderRadius: "6px", width: "100%", boxSizing: "border-box" },
    center: { textAlign: "center", color: "#888", padding: "20px 0" },
    empty: { textAlign: "center", color: "#aaa", padding: "24px 0", fontSize: "14px" },
    list: { display: "flex", flexDirection: "column" },
    contactRow: { display: "flex", alignItems: "center", gap: "12px", padding: "10px 6px", borderBottom: "1px solid #f0f0f0" },
    avatar: { width: "40px", height: "40px", borderRadius: "50%", objectFit: "cover", cursor: "pointer", flexShrink: 0 },
    contactInfo: { flex: 1, display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 },
    contactName: { fontSize: "14px", fontWeight: "500" },
    realName: { fontSize: "12px", color: "#888" },
    lastSeen: { fontSize: "12px", color: "#aaa" },
    editRow: { display: "flex", gap: "6px", alignItems: "center" },
    editInput: { flex: 1, padding: "6px 8px", fontSize: "13px", border: "1px solid #ccc", borderRadius: "4px" },
    actions: { display: "flex", gap: "4px" },
    actionBtn: { background: "none", border: "none", cursor: "pointer", fontSize: "16px", padding: "4px" },
    saveBtn: { padding: "5px 10px", fontSize: "12px", background: "#1a73e8", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer" },
    cancelBtn: { padding: "5px 10px", fontSize: "12px", background: "#f1f3f4", color: "#444", border: "1px solid #ccc", borderRadius: "4px", cursor: "pointer" },
    syncPanel: { display: "flex", flexDirection: "column", gap: "10px", borderTop: "1px solid #eee", paddingTop: "14px" },
    syncTitle: { margin: 0, fontSize: "14px", fontWeight: "500", color: "#333" },
    syncHint: { margin: 0, fontSize: "12px", color: "#888" },
    textarea: { padding: "10px", fontSize: "13px", border: "1px solid #ccc", borderRadius: "6px", resize: "vertical", fontFamily: "monospace", boxSizing: "border-box" },
    syncRow: { display: "flex", alignItems: "center", gap: "10px", padding: "8px 0", borderBottom: "1px solid #f5f5f5" },
    addBtn: { marginLeft: "auto", padding: "5px 12px", fontSize: "13px", background: "#1a73e8", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer" },
    removeBtn: { marginLeft: "auto", padding: "5px 12px", fontSize: "13px", background: "#fff", color: "#d32f2f", border: "1px solid #d32f2f", borderRadius: "4px", cursor: "pointer" },
    overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 },
    modal: { background: "#fff", borderRadius: "8px", padding: "24px", width: "320px", display: "flex", flexDirection: "column", gap: "12px" },
    modalTitle: { margin: 0, fontSize: "18px" },
    form: { display: "flex", flexDirection: "column", gap: "10px" },
    label: { fontSize: "13px", color: "#555" },
    input: { padding: "10px", fontSize: "14px", border: "1px solid #ccc", borderRadius: "6px" },
    modalBtns: { display: "flex", gap: "8px", marginTop: "4px" },
    error: { background: "#fdecea", color: "#b71c1c", padding: "10px", borderRadius: "6px", fontSize: "13px" },
    successBox: { background: "#e8f5e9", color: "#2e7d32", padding: "10px", borderRadius: "6px", fontSize: "13px" },
};