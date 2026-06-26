import { useState } from "react";
import { createGroup } from "../api/groupApi";

export default function NewGroupModal({ contacts, onClose, onCreated }) {
    const [name, setName] = useState("");
    const [selectedIds, setSelectedIds] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    const toggle = (userId) => {
        setSelectedIds((prev) =>
            prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
        );
    };

    const handleCreate = async () => {
        const trimmed = name.trim();
        if (!trimmed) {
            setError("Please enter a group name.");
            return;
        }

        setError("");
        setSubmitting(true);
        try {
            const group = await createGroup({ name: trimmed, memberIds: selectedIds });
            onCreated(group);
        } catch (err) {
            setError(err.response?.data?.message || "Could not create the group.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div style={styles.overlay} onClick={onClose}>
            <div style={styles.card} onClick={(e) => e.stopPropagation()}>
                <h3 style={styles.title}>New group</h3>

                {error && <div style={styles.error}>{error}</div>}

                <input
                    style={styles.input}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Group name"
                />

                <p style={styles.label}>Add members</p>
                <div style={styles.list}>
                    {contacts.length === 0 && <p style={styles.empty}>No contacts to add.</p>}
                    {contacts.map((contact) => (
                        <label key={contact.userId} style={styles.row}>
                            <input
                                type="checkbox"
                                checked={selectedIds.includes(contact.userId)}
                                onChange={() => toggle(contact.userId)}
                            />
                            <span>{contact.name || "Unknown"}</span>
                        </label>
                    ))}
                </div>

                <div style={styles.actions}>
                    <button style={styles.cancel} onClick={onClose} disabled={submitting}>
                        Cancel
                    </button>
                    <button style={styles.create} onClick={handleCreate} disabled={submitting}>
                        {submitting ? "Creating..." : "Create"}
                    </button>
                </div>
            </div>
        </div>
    );
}

const styles = {
    overlay: {
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
    },
    card: {
        width: "340px",
        background: "var(--c-panel)",
        color: "var(--c-text)",
        borderRadius: "10px",
        padding: "20px",
        border: "1px solid var(--c-surface)",
    },
    title: { margin: "0 0 14px", fontSize: "18px" },
    label: { fontSize: "13px", color: "var(--c-muted)", margin: "14px 0 6px" },
    input: {
        width: "100%",
        boxSizing: "border-box",
        padding: "10px",
        fontSize: "14px",
        border: "1px solid var(--c-border2)",
        borderRadius: "6px",
        background: "var(--c-border2)",
        color: "var(--c-text)",
        outline: "none",
    },
    list: {
        maxHeight: "180px",
        overflowY: "auto",
        border: "1px solid var(--c-surface)",
        borderRadius: "6px",
        padding: "6px",
    },
    row: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "6px 4px",
        fontSize: "14px",
        cursor: "pointer",
    },
    empty: { fontSize: "13px", color: "var(--c-muted)", padding: "6px 4px" },
    actions: { display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "16px" },
    cancel: {
        padding: "8px 14px",
        border: "1px solid var(--c-border2)",
        borderRadius: "6px",
        background: "transparent",
        color: "var(--c-text)",
        cursor: "pointer",
    },
    create: {
        padding: "8px 16px",
        border: "none",
        borderRadius: "6px",
        background: "#00a884",
        color: "#fff",
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
