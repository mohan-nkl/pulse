import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
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

    const [showAdd, setShowAdd] = useState(false);
    const [addPhone, setAddPhone] = useState("");
    const [addAlias, setAddAlias] = useState("");
    const [addLoading, setAddLoading] = useState(false);
    const [addError, setAddError] = useState("");

    const [editingId, setEditingId] = useState(null);
    const [editAlias, setEditAlias] = useState("");
    const [editLoading, setEditLoading] = useState(false);

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

    const openChat = (c) => {
        sessionStorage.setItem("pulse_selected", JSON.stringify({ type: "dm", userId: c.contactId }));
        navigate("/chat");
    };
    const avatarSrc = (name, url) =>
        url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "U")}&size=80&background=1f2c33&color=8696a0`;

    return (
        <div style={styles.page}>
            <style>{css}</style>
            <div style={styles.card}>

                {}
                <div style={styles.header}>
                    <div style={styles.headerTitleWrap}>
                        <h1 style={styles.title}>Contacts</h1>
                        {!loading && <span style={styles.count}>{contacts.length}</span>}
                    </div>
                    <div style={styles.headerBtns}>
                        <button
                            style={styles.secondaryBtn}
                            className="pulse-secondary"
                            onClick={() => navigate("/blocked")}
                        >
                            Blocked
                        </button>
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

                <div style={styles.searchWrap}>
                    <svg style={styles.searchIcon} viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="7" />
                        <path d="m20 20-3.2-3.2" />
                    </svg>
                    <input
                        className="pulse-cinput"
                        style={styles.search}
                        type="text"
                        placeholder="Search by name, alias or phone…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                </div>

                {}
                {loading ? (
                    <div style={styles.center}>Loading...</div>
                ) : contacts.length === 0 ? (
                    <div style={styles.empty}>
                        <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="var(--c-muted2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        <p style={styles.emptyTitle}>No contacts yet</p>
                        <p style={styles.emptySub}>Use “+ Add” or “Sync” to find people on Pulse.</p>
                    </div>
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
                                            <span style={{ ...styles.contactName, cursor: "pointer" }} onClick={() => openChat(c)}>{displayName(c)}</span>
                                            {c.alias && <span style={styles.realName}>{c.name}</span>}
                                        </>
                                    )}
                                    <span style={styles.lastSeen}>{formatLastSeen(c.lastSeen)}</span>
                                </div>
                                {editingId !== c.id && (
                                    <div style={styles.actions}>
                                        <button style={styles.actionBtn} className="pulse-action" onClick={() => openChat(c)} title="Message">
                                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                                            </svg>
                                        </button>
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

                {}
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

            {}
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
        background: "radial-gradient(1200px 500px at 50% -10%, rgba(74,157,137,0.10), transparent 60%), var(--c-bg)",
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
    card: {
        width: "100%", maxWidth: "580px",
        background: "var(--c-panel)", border: "1px solid var(--c-border)", borderRadius: "20px",
        padding: "26px 28px", display: "flex", flexDirection: "column", gap: "18px",
        boxShadow: "var(--c-shadow)", color: "var(--c-text)",
    },
    header: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" },
    headerTitleWrap: { display: "flex", alignItems: "center", gap: "10px" },
    title: { fontSize: "21px", fontWeight: 600, margin: 0 },
    count: {
        fontSize: "12.5px", fontWeight: 600, color: "var(--c-muted)",
        background: "var(--c-surface3)", border: "1px solid var(--c-border)",
        borderRadius: "999px", padding: "2px 11px", lineHeight: 1.7,
    },
    headerBtns: { display: "flex", gap: "10px", alignItems: "center" },
    primaryBtn: { padding: "9px 17px", fontSize: "14px", fontWeight: 600, background: "var(--c-accent)", color: "var(--c-on-accent)", border: "none", borderRadius: "10px", cursor: "pointer" },
    secondaryBtn: { padding: "9px 16px", fontSize: "14px", fontWeight: 500, background: "var(--c-surface3)", color: "var(--c-text)", border: "1px solid var(--c-border2)", borderRadius: "10px", cursor: "pointer" },
    searchWrap: { position: "relative", display: "flex", alignItems: "center" },
    searchIcon: { position: "absolute", left: "13px", color: "var(--c-muted2)", pointerEvents: "none" },
    search: { padding: "12px 14px 12px 38px", fontSize: "14px", background: "var(--c-surface)", border: "1px solid var(--c-border2)", borderRadius: "12px", width: "100%", boxSizing: "border-box", color: "var(--c-text)", outline: "none", transition: "border-color 0.15s ease, box-shadow 0.15s ease" },
    center: { textAlign: "center", color: "var(--c-muted)", padding: "20px 0" },
    empty: { display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", color: "var(--c-muted2)", padding: "40px 0" },
    emptyTitle: { fontSize: "15px", fontWeight: 600, color: "var(--c-muted)", margin: "8px 0 0" },
    emptySub: { fontSize: "13px", color: "var(--c-muted2)", margin: 0 },
    list: { display: "flex", flexDirection: "column" },
    contactRow: { display: "flex", alignItems: "center", gap: "13px", padding: "12px 10px", borderBottom: "1px solid var(--c-border)", borderRadius: "12px", transition: "background 0.15s ease" },
    avatar: { width: "46px", height: "46px", borderRadius: "50%", objectFit: "cover", cursor: "pointer", flexShrink: 0, border: "1px solid var(--c-border2)" },
    contactInfo: { flex: 1, display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 },
    contactName: { fontSize: "15px", fontWeight: 600 },
    realName: { fontSize: "12px", color: "var(--c-muted)" },
    lastSeen: { fontSize: "12px", color: "var(--c-muted2)" },
    editRow: { display: "flex", gap: "6px", alignItems: "center" },
    editInput: { flex: 1, padding: "7px 9px", fontSize: "13px", background: "var(--c-bg)", border: "1px solid var(--c-border2)", borderRadius: "7px", color: "var(--c-text)", outline: "none" },
    actions: { display: "flex", gap: "4px" },
    actionBtn: { background: "none", border: "none", cursor: "pointer", padding: "8px", borderRadius: "9px", color: "var(--c-muted)", display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s ease, color 0.15s ease" },
    saveBtn: { padding: "6px 12px", fontSize: "12px", fontWeight: 600, background: "var(--c-accent)", color: "var(--c-on-accent)", border: "none", borderRadius: "7px", cursor: "pointer" },
    cancelBtn: { flex: 1, padding: "11px", fontSize: "14px", fontWeight: 500, background: "transparent", color: "var(--c-text)", border: "1px solid var(--c-border2)", borderRadius: "10px", cursor: "pointer" },
    cancelBtnSm: { padding: "6px 10px", fontSize: "12px", background: "transparent", color: "var(--c-muted)", border: "1px solid var(--c-border2)", borderRadius: "7px", cursor: "pointer" },
    syncPanel: { display: "flex", flexDirection: "column", gap: "10px", borderTop: "1px solid var(--c-border)", paddingTop: "14px" },
    syncTitle: { margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--c-text)" },
    syncHint: { margin: 0, fontSize: "12px", color: "var(--c-muted)" },
    textarea: { padding: "10px", fontSize: "13px", background: "var(--c-bg)", border: "1px solid var(--c-border2)", borderRadius: "10px", resize: "vertical", fontFamily: "monospace", boxSizing: "border-box", color: "var(--c-text)", outline: "none" },
    syncRow: { display: "flex", alignItems: "center", gap: "10px", padding: "8px 0", borderBottom: "1px solid var(--c-border)" },
    addBtn: { marginLeft: "auto", padding: "6px 14px", fontSize: "13px", fontWeight: 600, background: "var(--c-accent)", color: "var(--c-on-accent)", border: "none", borderRadius: "7px", cursor: "pointer" },
    removeBtn: { marginLeft: "auto", padding: "6px 14px", fontSize: "13px", background: "transparent", color: "#f15c6d", border: "1px solid #f15c6d", borderRadius: "7px", cursor: "pointer" },
    overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "16px" },
    modal: { background: "var(--c-panel)", border: "1px solid var(--c-border)", borderRadius: "16px", padding: "24px", width: "340px", maxWidth: "100%", display: "flex", flexDirection: "column", gap: "12px", color: "var(--c-text)", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" },
    modalTitle: { margin: 0, fontSize: "18px", fontWeight: 600 },
    form: { display: "flex", flexDirection: "column", gap: "8px" },
    label: { fontSize: "13px", color: "var(--c-muted)", marginTop: "6px" },
    input: { padding: "11px 12px", fontSize: "14px", background: "var(--c-bg)", border: "1px solid var(--c-border2)", borderRadius: "9px", color: "var(--c-text)", boxSizing: "border-box", outline: "none" },
    modalBtns: { display: "flex", gap: "8px", marginTop: "8px" },
    error: { background: "rgba(241,92,109,0.12)", color: "#f7919c", padding: "10px 12px", borderRadius: "9px", fontSize: "13px" },
    successBox: { background: "rgba(74,157,137,0.14)", color: "var(--c-accent)", padding: "10px 12px", borderRadius: "9px", fontSize: "13px" },
};

const css = `
.pulse-btn:hover { background: var(--c-accent-hover) !important; }
.pulse-btn:disabled { opacity: 0.6; cursor: default; }
.pulse-secondary:hover { background: var(--c-surface4) !important; }
.pulse-contact-row:hover { background: var(--c-surface3); }
.pulse-action:hover { background: rgba(74,157,137,0.16); color: var(--c-accent) !important; }
.pulse-action-danger:hover { background: rgba(241,92,109,0.14); color: #f15c6d !important; }
.pulse-cinput:focus { border-color: var(--c-accent); box-shadow: 0 0 0 3px rgba(74,157,137,0.18); }
input::placeholder, textarea::placeholder { color: var(--c-muted2); }
`;
