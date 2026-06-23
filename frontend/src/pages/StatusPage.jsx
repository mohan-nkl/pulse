import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
    getMyStatuses,
    getContactStatuses,
    createStatus,
    uploadStatusMedia,
    viewStatus,
    deleteStatus,
} from "../api/statusApi";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function timeAgo(iso) {
    if (!iso) return "";
    const mins = Math.floor((Date.now() - new Date(iso)) / 60000);
    if (mins < 1)  return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

function avatarSrc(name, url) {
    return url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "U")}&size=96&background=2a3942&color=fff`;
}

// ─────────────────────────────────────────────────────────────────────────────
// RingAvatar — avatar with a coloured ring (green = unread, grey = seen/none)
// ─────────────────────────────────────────────────────────────────────────────

function RingAvatar({ name, url, hasUnread, size = 46 }) {
    const ring = hasUnread ? "#00a884" : "#3a4a54";
    return (
        <div style={{
            width: size + 6, height: size + 6,
            borderRadius: "50%",
            background: ring,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
        }}>
            <img
                src={avatarSrc(name, url)}
                alt={name}
                style={{
                    width: size, height: size,
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: "2px solid #111b21",
                }}
            />
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// StatusViewer — fullscreen modal, cycles through one author's statuses
// ─────────────────────────────────────────────────────────────────────────────

function StatusViewer({ statuses, onClose }) {
    const [idx, setIdx] = useState(0);
    const current = statuses[idx];

    // Mark viewed as soon as the item appears
    useEffect(() => {
        if (current && !current.viewedByMe) {
            viewStatus(current.id).catch(() => {});
        }
    }, [current]);

    if (!current) return null;

    const goNext = () => idx < statuses.length - 1 ? setIdx(idx + 1) : onClose();
    const goPrev = () => idx > 0 && setIdx(idx - 1);

    return (
        <div style={v.backdrop} onClick={onClose}>
            <div style={v.card} onClick={e => e.stopPropagation()}>

                {/* Progress segments */}
                <div style={v.progress}>
                    {statuses.map((_, i) => (
                        <div key={i} style={{
                            flex: 1, height: 3, borderRadius: 2,
                            background: i <= idx ? "#e9edef" : "#3a4a54",
                        }} />
                    ))}
                </div>

                {/* Header */}
                <div style={v.header}>
                    <RingAvatar name={current.authorName} url={current.authorAvatarUrl} hasUnread={false} size={34} />
                    <div style={{ marginLeft: 10, flex: 1 }}>
                        <div style={v.name}>{current.authorName}</div>
                        <div style={v.ts}>{timeAgo(current.createdAt)}</div>
                    </div>
                    <button style={v.closeBtn} onClick={onClose}>✕</button>
                </div>

                {/* Media (image) */}
                {current.mediaUrl && (
                    <div style={v.mediaWrap}>
                        <img
                            src={current.mediaUrl}
                            alt="status"
                            style={v.media}
                        />
                    </div>
                )}

                {/* Text content */}
                {current.content && (
                    <div style={{
                        ...v.textBox,
                        // if there's also an image, overlay text on a dark bar below it
                        marginTop: current.mediaUrl ? 0 : 8,
                        borderRadius: current.mediaUrl ? "0 0 8px 8px" : 8,
                    }}>
                        <p style={v.text}>{current.content}</p>
                    </div>
                )}

                {/* View count — only for the author's own statuses */}
                {current.viewCount != null && (
                    <div style={v.views}>
                        👁 {current.viewCount} view{current.viewCount !== 1 ? "s" : ""}
                    </div>
                )}

                {/* Navigation */}
                <div style={v.nav}>
                    <button style={v.navBtn} onClick={goPrev} disabled={idx === 0}>← Prev</button>
                    <span style={v.counter}>{idx + 1} / {statuses.length}</span>
                    <button style={v.navBtn} onClick={goNext}>
                        {idx < statuses.length - 1 ? "Next →" : "Close"}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// ComposeForm — text + optional image, shown inline in sidebar
// ─────────────────────────────────────────────────────────────────────────────

function ComposeForm({ onPosted, onCancel }) {
    const [text, setText] = useState("");
    const [imageFile, setImageFile]   = useState(null);  // File object
    const [preview, setPreview]       = useState(null);  // local object URL
    const [uploading, setUploading]   = useState(false);
    const [posting, setPosting]       = useState(false);
    const [error, setError]           = useState("");
    const fileRef = useRef(null);

    const canPost = !posting && !uploading && (text.trim() || imageFile);

    const handleImage = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setImageFile(file);
        setPreview(URL.createObjectURL(file));
        setError("");
    };

    const removeImage = () => {
        setImageFile(null);
        if (preview) URL.revokeObjectURL(preview);
        setPreview(null);
        if (fileRef.current) fileRef.current.value = "";
    };

    const handlePost = async () => {
        if (!canPost) return;
        setError("");
        let mediaUrl = null;

        // Step 1: upload image if one was selected
        if (imageFile) {
            setUploading(true);
            try {
                mediaUrl = await uploadStatusMedia(imageFile);
            } catch (err) {
                setError(err.response?.data?.message || "Image upload failed.");
                setUploading(false);
                return;
            }
            setUploading(false);
        }

        // Step 2: create the status row
        setPosting(true);
        try {
            const newStatus = await createStatus({
                content: text.trim() || null,
                mediaUrl,
            });
            onPosted(newStatus);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to post status.");
        } finally {
            setPosting(false);
        }
    };

    const statusLabel = uploading ? "Uploading image…"
                      : posting   ? "Posting…"
                      : "Post";

    return (
        <div style={c.box}>

            {/* Image preview */}
            {preview && (
                <div style={c.previewWrap}>
                    <img src={preview} alt="preview" style={c.preview} />
                    <button style={c.removeImg} onClick={removeImage} title="Remove image">✕</button>
                </div>
            )}

            {/* Text area */}
            <textarea
                style={c.textarea}
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder={imageFile ? "Add a caption… (optional)" : "What's on your mind?"}
                maxLength={700}
                rows={3}
                autoFocus={!imageFile}
            />

            {/* Bottom row */}
            <div style={c.row}>
                {/* Image picker */}
                <button
                    style={c.imgBtn}
                    onClick={() => fileRef.current.click()}
                    title="Add image"
                    disabled={posting || uploading}
                >
                    🖼
                </button>
                <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    style={{ display: "none" }}
                    onChange={handleImage}
                />

                <span style={c.chars}>{text.length}/700</span>

                {error && <span style={c.err}>{error}</span>}

                <button style={c.cancelBtn} onClick={onCancel} disabled={posting || uploading}>
                    Cancel
                </button>
                <button style={{ ...c.postBtn, opacity: canPost ? 1 : 0.5 }}
                    onClick={handlePost} disabled={!canPost}>
                    {statusLabel}
                </button>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function StatusPage() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [myStatuses,      setMyStatuses]      = useState([]);
    const [contactStatuses, setContactStatuses] = useState([]);
    const [loading,  setLoading]  = useState(true);
    const [error,    setError]    = useState("");
    const [composing, setComposing] = useState(false);
    const [viewer,    setViewer]    = useState(null); // array of statuses to show

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const [mine, contacts] = await Promise.all([getMyStatuses(), getContactStatuses()]);
            setMyStatuses(mine);
            setContactStatuses(contacts);
        } catch {
            setError("Could not load statuses. Is the server running?");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    // Group flat contact list by author (one sidebar row per person)
    const grouped = [];
    const seen = new Set();
    for (const s of contactStatuses) {
        if (!seen.has(s.authorId)) {
            seen.add(s.authorId);
            const items     = contactStatuses.filter(x => x.authorId === s.authorId);
            const hasUnread = items.some(x => !x.viewedByMe);
            grouped.push({ authorId: s.authorId, authorName: s.authorName,
                           authorAvatarUrl: s.authorAvatarUrl, hasUnread, items });
        }
    }

    const handlePosted = (newStatus) => {
        setMyStatuses(prev => [newStatus, ...prev]);
        setComposing(false);
    };

    const handleDelete = async (statusId) => {
        try {
            await deleteStatus(statusId);
            setMyStatuses(prev => prev.filter(s => s.id !== statusId));
        } catch { /* silent */ }
    };

    return (
        <div style={p.page}>

            {/* ── Sidebar ────────────────────────────────────────────────── */}
            <div style={p.sidebar}>

                <div style={p.sidebarHeader}>
                    <h2 style={p.title}>Status</h2>
                    <button style={p.backBtn} onClick={() => navigate(-1)}>← Back</button>
                </div>

                {loading && <p style={p.hint}>Loading…</p>}
                {error   && <p style={p.errText}>{error}</p>}

                {/* My Status row */}
                <div style={p.section}>
                    <div style={p.label}>MY STATUS</div>

                    <div style={p.row}
                        onClick={() => myStatuses.length > 0 && setViewer(myStatuses)}>
                        <div style={{ position: "relative", flexShrink: 0 }}>
                            <RingAvatar
                                name={user?.name}
                                url={user?.avatarUrl}
                                hasUnread={myStatuses.length > 0}
                                size={44}
                            />
                            <button
                                style={p.addDot}
                                onClick={e => { e.stopPropagation(); setComposing(v => !v); }}
                                title="Add status"
                            >+</button>
                        </div>
                        <div style={p.info}>
                            <span style={p.rowName}>My Status</span>
                            <span style={p.rowSub}>
                                {myStatuses.length > 0
                                    ? `${myStatuses.length} update${myStatuses.length > 1 ? "s" : ""} · tap to view`
                                    : "Tap + to add a status"}
                            </span>
                        </div>
                    </div>

                    {composing && (
                        <ComposeForm
                            onPosted={handlePosted}
                            onCancel={() => setComposing(false)}
                        />
                    )}
                </div>

                {/* Contact statuses */}
                {grouped.length > 0 && (
                    <div style={p.section}>
                        <div style={p.label}>RECENT UPDATES</div>
                        {grouped.map(g => (
                            <div key={g.authorId} style={p.row}
                                onClick={() => setViewer(g.items)}>
                                <RingAvatar
                                    name={g.authorName}
                                    url={g.authorAvatarUrl}
                                    hasUnread={g.hasUnread}
                                    size={44}
                                />
                                <div style={p.info}>
                                    <span style={p.rowName}>{g.authorName}</span>
                                    <span style={p.rowSub}>
                                        {timeAgo(g.items[0]?.createdAt)}
                                        {g.hasUnread && <span style={p.newBadge}> · new</span>}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {!loading && grouped.length === 0 && myStatuses.length === 0 && (
                    <p style={p.hint}>No updates yet. Be the first!</p>
                )}
            </div>

            {/* ── Main panel — my own status cards ─────────────────────── */}
            <div style={p.main}>
                {myStatuses.length === 0 ? (
                    <div style={p.empty}>
                        <p style={p.emptyText}>No active statuses</p>
                        <button style={p.postFirstBtn} onClick={() => setComposing(true)}>
                            + Post your first status
                        </button>
                    </div>
                ) : (
                    <div style={p.cardList}>
                        <h3 style={p.cardListTitle}>Your active statuses</h3>
                        {myStatuses.map(s => (
                            <div key={s.id} style={p.card}>

                                {/* Image */}
                                {s.mediaUrl && (
                                    <img src={s.mediaUrl} alt="status" style={p.cardImg} />
                                )}

                                {/* Text */}
                                {s.content && (
                                    <p style={p.cardText}>{s.content}</p>
                                )}

                                <div style={p.cardMeta}>
                                    <span>{timeAgo(s.createdAt)}</span>
                                    <span>👁 {s.viewCount ?? 0}</span>
                                    <span style={{ color: "#3a4a54" }}>
                                        expires {timeAgo(
                                            new Date(new Date(s.expiresAt).getTime())
                                        )} from now
                                    </span>
                                    <button
                                        style={p.delBtn}
                                        onClick={() => handleDelete(s.id)}
                                        title="Delete"
                                    >🗑</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Viewer modal ─────────────────────────────────────────── */}
            {viewer && (
                <StatusViewer
                    statuses={viewer}
                    onClose={() => { setViewer(null); load(); }}
                />
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

// Viewer
const v = {
    backdrop: {
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.88)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000,
    },
    card: {
        background: "#1f2c34", borderRadius: 12,
        width: 400, maxWidth: "95vw",
        padding: "16px 20px 20px",
        display: "flex", flexDirection: "column", gap: 12,
    },
    progress: { display: "flex", gap: 4 },
    header:   { display: "flex", alignItems: "center" },
    name:     { fontSize: 15, fontWeight: 600, color: "#e9edef" },
    ts:       { fontSize: 12, color: "#8696a0" },
    closeBtn: { marginLeft: "auto", background: "none", border: "none", color: "#8696a0", fontSize: 18, cursor: "pointer" },
    mediaWrap:{ borderRadius: 8, overflow: "hidden", maxHeight: 320, display:"flex", alignItems:"center", justifyContent:"center", background:"#000" },
    media:    { width: "100%", maxHeight: 320, objectFit: "contain" },
    textBox:  { background: "#2a3942", padding: "14px 16px" },
    text:     { fontSize: 18, color: "#e9edef", margin: 0, textAlign: "center", whiteSpace: "pre-wrap", wordBreak: "break-word" },
    views:    { fontSize: 13, color: "#8696a0", textAlign: "right" },
    nav:      { display: "flex", alignItems: "center", justifyContent: "space-between" },
    navBtn:   { background: "#2a3942", border: "none", borderRadius: 6, color: "#e9edef", padding: "8px 14px", cursor: "pointer", fontSize: 13 },
    counter:  { fontSize: 13, color: "#8696a0" },
};

// Compose form
const c = {
    box:        { margin: "0 12px 12px", background: "#1f2c34", borderRadius: 8, padding: 12, display: "flex", flexDirection: "column", gap: 8 },
    previewWrap:{ position: "relative", borderRadius: 6, overflow: "hidden" },
    preview:    { width: "100%", maxHeight: 160, objectFit: "cover", display: "block", borderRadius: 6 },
    removeImg:  { position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.6)", border: "none", color: "#fff", borderRadius: "50%", width: 24, height: 24, cursor: "pointer", fontSize: 13, lineHeight: "24px", textAlign: "center", padding: 0 },
    textarea:   { width: "100%", boxSizing: "border-box", background: "#2a3942", border: "1px solid #3a4a54", borderRadius: 6, color: "#e9edef", fontSize: 14, padding: "8px 10px", resize: "none", outline: "none", fontFamily: "inherit" },
    row:        { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" },
    imgBtn:     { background: "none", border: "1px solid #3a4a54", borderRadius: 6, color: "#8696a0", padding: "4px 8px", cursor: "pointer", fontSize: 16 },
    chars:      { fontSize: 11, color: "#8696a0" },
    err:        { fontSize: 12, color: "#ff6b6b", flex: 1 },
    cancelBtn:  { background: "none", border: "1px solid #3a4a54", borderRadius: 6, color: "#8696a0", padding: "6px 10px", cursor: "pointer", fontSize: 12 },
    postBtn:    { background: "#00a884", border: "none", borderRadius: 6, color: "#fff", padding: "6px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600, marginLeft: "auto" },
};

// Page layout
const p = {
    page:          { display: "flex", height: "100vh", background: "#0b141a", color: "#e9edef" },
    sidebar:       { width: 300, borderRight: "1px solid #222d34", background: "#111b21", overflowY: "auto", display: "flex", flexDirection: "column" },
    sidebarHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 16px 8px" },
    title:         { fontSize: 18, margin: 0, color: "#e9edef" },
    backBtn:       { background: "none", border: "none", color: "#00a884", fontSize: 13, cursor: "pointer" },
    section:       { borderBottom: "1px solid #222d34", paddingBottom: 8 },
    label:         { fontSize: 11, letterSpacing: "0.5px", color: "#8696a0", padding: "12px 16px 4px" },
    row:           { display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", cursor: "pointer" },
    info:          { display: "flex", flexDirection: "column", gap: 2 },
    rowName:       { fontSize: 15, fontWeight: 500, color: "#e9edef" },
    rowSub:        { fontSize: 12, color: "#8696a0" },
    newBadge:      { color: "#00a884", fontWeight: 600 },
    addDot:        { position: "absolute", bottom: -2, right: -2, width: 20, height: 20, borderRadius: "50%", background: "#00a884", border: "2px solid #111b21", color: "#fff", fontSize: 16, lineHeight: "16px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 },
    hint:          { fontSize: 13, color: "#8696a0", padding: "12px 16px" },
    errText:       { fontSize: 13, color: "#ff6b6b", padding: "12px 16px" },
    main:          { flex: 1, overflowY: "auto", background: "#0b141a", display: "flex", alignItems: "flex-start", justifyContent: "center" },
    empty:         { display: "flex", flexDirection: "column", alignItems: "center", gap: 16, marginTop: 120 },
    emptyText:     { fontSize: 15, color: "#8696a0", margin: 0 },
    postFirstBtn:  { background: "#00a884", border: "none", borderRadius: 8, color: "#fff", padding: "12px 24px", fontSize: 15, cursor: "pointer" },
    cardList:      { width: "100%", maxWidth: 580, padding: 24, display: "flex", flexDirection: "column", gap: 12 },
    cardListTitle: { fontSize: 16, color: "#8696a0", margin: "0 0 4px", fontWeight: 400 },
    card:          { background: "#1f2c34", borderRadius: 10, overflow: "hidden" },
    cardImg:       { width: "100%", maxHeight: 260, objectFit: "cover", display: "block" },
    cardText:      { fontSize: 16, color: "#e9edef", margin: 0, padding: "14px 16px", whiteSpace: "pre-wrap", wordBreak: "break-word" },
    cardMeta:      { display: "flex", alignItems: "center", gap: 14, padding: "10px 16px", fontSize: 12, color: "#8696a0", borderTop: "1px solid #2a3942" },
    delBtn:        { marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#8696a0" },
};