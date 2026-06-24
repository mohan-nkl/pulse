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
        url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "U")}&size=80&background=1f2c33&color=8696a0`;

    return (
        <div style={styles.page}>
            <style>{css}</style>
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
                            className="pulse-secondary"
                            onClick={() => { setShowSync(!showSync); setSyncResults([]); setSyncError(""); }}
                        >
                            {showSync ? "Hide Sync" : "Sync"}
                        </button>
                        <button style={styles.primaryBtn} className="pulse-btn" onClick={() => { setShowAdd(true); setAddError(""); }}>
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
                            <div key={c.id} style={styles.contactRow} className="pulse-contact-row">
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
                                                className="pulse-btn"
                                                onClick={() => handleEditSave(c.id)}
                                                disabled={editLoading}
                                            >
                                                {editLoading ? "..." : "Save"}
                                            </button>
                                            <button style={styles.cancelBtnSm} onClick={() => setEditingId(null)}>
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
                                        <button style={styles.actionBtn} className="pulse-action" onClick={() => startEdit(c)} title="Edit alias">
                                            <PencilIcon />
                                        </button>
                                        <button style={styles.actionBtn} className="pulse-action-danger" onClick={() => handleRemove(c.id)} title="Remove">
                                            <TrashIcon />
                                        </button>
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
                        <button style={styles.primaryBtn} className="pulse-btn" onClick={handleSync} disabled={syncLoading}>
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
                                    <button style={styles.addBtn} className="pulse-btn" onClick={() => handleAddFromSync(u)}>
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
                                <button type="submit" style={styles.primaryBtn} className="pulse-btn" disabled={addLoading}>
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

function PencilIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
             strokeLinecap="round" strokeLinejoin="round" width="17" height="17">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
    );
}

function TrashIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
             strokeLinecap="round" strokeLinejoin="round" width="17" height="17">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
    );
}

const styles = {
    page: {
        display: "flex", justifyContent: "center", alignItems: "flex-start",
        minHeight: "100vh", padding: "40px 16px", boxSizing: "border-box",
        background: "radial-gradient(1200px 500px at 50% -10%, rgba(0,168,132,0.10), transparent 60%), #0b141a",
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
    card: {
        width: "100%", maxWidth: "480px",
        background: "#111b21", border: "1px solid #1f2c33", borderRadius: "18px",
        padding: "22px", display: "flex", flexDirection: "column", gap: "14px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.45)", color: "#e9edef",
    },
    header: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" },
    title: { fontSize: "20px", fontWeight: 600, margin: 0 },
    headerBtns: { display: "flex", gap: "8px" },
    primaryBtn: { padding: "8px 15px", fontSize: "14px", fontWeight: 600, background: "#00a884", color: "#0b141a", border: "none", borderRadius: "9px", cursor: "pointer" },
    secondaryBtn: { padding: "8px 15px", fontSize: "14px", fontWeight: 500, background: "#16222a", color: "#e9edef", border: "1px solid #2a3942", borderRadius: "9px", cursor: "pointer" },
    search: { padding: "11px 12px", fontSize: "14px", background: "#0b141a", border: "1px solid #2a3942", borderRadius: "10px", width: "100%", boxSizing: "border-box", color: "#e9edef", outline: "none" },
    center: { textAlign: "center", color: "#8696a0", padding: "20px 0" },
    empty: { textAlign: "center", color: "#5b6b74", padding: "24px 0", fontSize: "14px" },
    list: { display: "flex", flexDirection: "column" },
    contactRow: { display: "flex", alignItems: "center", gap: "12px", padding: "11px 8px", borderBottom: "1px solid #1f2c33", borderRadius: "10px", transition: "background 0.15s ease" },
    avatar: { width: "44px", height: "44px", borderRadius: "50%", objectFit: "cover", cursor: "pointer", flexShrink: 0, border: "1px solid #2a3942" },
    contactInfo: { flex: 1, display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 },
    contactName: { fontSize: "14.5px", fontWeight: 600 },
    realName: { fontSize: "12px", color: "#8696a0" },
    lastSeen: { fontSize: "12px", color: "#5b6b74" },
    editRow: { display: "flex", gap: "6px", alignItems: "center" },
    editInput: { flex: 1, padding: "7px 9px", fontSize: "13px", background: "#0b141a", border: "1px solid #2a3942", borderRadius: "7px", color: "#e9edef", outline: "none" },
    actions: { display: "flex", gap: "2px" },
    actionBtn: { background: "none", border: "none", cursor: "pointer", padding: "7px", borderRadius: "8px", color: "#8696a0", display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s ease, color 0.15s ease" },
    saveBtn: { padding: "6px 12px", fontSize: "12px", fontWeight: 600, background: "#00a884", color: "#0b141a", border: "none", borderRadius: "7px", cursor: "pointer" },
    cancelBtn: { flex: 1, padding: "11px", fontSize: "14px", fontWeight: 500, background: "transparent", color: "#e9edef", border: "1px solid #2a3942", borderRadius: "10px", cursor: "pointer" },
    cancelBtnSm: { padding: "6px 10px", fontSize: "12px", background: "transparent", color: "#8696a0", border: "1px solid #2a3942", borderRadius: "7px", cursor: "pointer" },
    syncPanel: { display: "flex", flexDirection: "column", gap: "10px", borderTop: "1px solid #1f2c33", paddingTop: "14px" },
    syncTitle: { margin: 0, fontSize: "14px", fontWeight: 600, color: "#e9edef" },
    syncHint: { margin: 0, fontSize: "12px", color: "#8696a0" },
    textarea: { padding: "10px", fontSize: "13px", background: "#0b141a", border: "1px solid #2a3942", borderRadius: "10px", resize: "vertical", fontFamily: "monospace", boxSizing: "border-box", color: "#e9edef", outline: "none" },
    syncRow: { display: "flex", alignItems: "center", gap: "10px", padding: "8px 0", borderBottom: "1px solid #1f2c33" },
    addBtn: { marginLeft: "auto", padding: "6px 14px", fontSize: "13px", fontWeight: 600, background: "#00a884", color: "#0b141a", border: "none", borderRadius: "7px", cursor: "pointer" },
    removeBtn: { marginLeft: "auto", padding: "6px 14px", fontSize: "13px", background: "transparent", color: "#f15c6d", border: "1px solid #f15c6d", borderRadius: "7px", cursor: "pointer" },
    overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "16px" },
    modal: { background: "#111b21", border: "1px solid #1f2c33", borderRadius: "16px", padding: "24px", width: "340px", maxWidth: "100%", display: "flex", flexDirection: "column", gap: "12px", color: "#e9edef", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" },
    modalTitle: { margin: 0, fontSize: "18px", fontWeight: 600 },
    form: { display: "flex", flexDirection: "column", gap: "8px" },
    label: { fontSize: "13px", color: "#8696a0", marginTop: "6px" },
    input: { padding: "11px 12px", fontSize: "14px", background: "#0b141a", border: "1px solid #2a3942", borderRadius: "9px", color: "#e9edef", boxSizing: "border-box", outline: "none" },
    modalBtns: { display: "flex", gap: "8px", marginTop: "8px" },
    error: { background: "rgba(241,92,109,0.12)", color: "#f7919c", padding: "10px 12px", borderRadius: "9px", fontSize: "13px" },
    successBox: { background: "rgba(0,168,132,0.14)", color: "#38d39f", padding: "10px 12px", borderRadius: "9px", fontSize: "13px" },
};

const css = `
.pulse-btn:hover { background: #06cf7f !important; }
.pulse-btn:disabled { opacity: 0.6; cursor: default; }
.pulse-secondary:hover { background: #1d2a32 !important; }
.pulse-contact-row:hover { background: #16222a; }
.pulse-action:hover { background: rgba(0,168,132,0.16); color: #38d39f !important; }
.pulse-action-danger:hover { background: rgba(241,92,109,0.14); color: #f15c6d !important; }
input::placeholder, textarea::placeholder { color: #5b6b74; }
`;