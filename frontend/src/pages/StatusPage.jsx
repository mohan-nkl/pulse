import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import {
    getMyStatuses,
    getContactStatuses,
    createStatus,
    uploadStatusMedia,
    viewStatus,
    deleteStatus,
    getStatusViewers,
    replyToStatus,
} from "../api/statusApi";

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

function isVideoUrl(url) {
    if (!url) return false;
    const path = url.split("?")[0].toLowerCase();
    const videoExtensions = [".mp4", ".webm", ".mov", ".ogg", ".m4v"];
    return videoExtensions.some((ext) => path.endsWith(ext));
}

function StatusMedia({ url, style }) {
    if (!url) return null;
    if (isVideoUrl(url)) {
        return <video src={url} controls style={style} />;
    }
    return <img src={url} alt="status" style={style} />;
}

function RingAvatar({ name, url, hasUnread, size = 46 }) {
    const ring = hasUnread ? "var(--c-accent)" : "var(--c-border3)";
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
                    border: "2px solid var(--c-panel)",
                }}
            />
        </div>
    );
}

function StatusCard({ status, onDelete }) {
    const { addListener } = useSocket();
    const [viewers, setViewers] = useState([]);

    useEffect(() => {
        if (status.viewCount > 0) {
            getStatusViewers(status.id).then(setViewers).catch(() => {});
        }
    }, [status.id, status.viewCount]);

    useEffect(() => {
        const off = addListener("statusView", (event) => {
            if (event.statusId === status.id) {
                getStatusViewers(status.id).then(setViewers).catch(() => {});
            }
        });
        return off;
    }, [addListener, status.id]);

    return (
        <div style={p.card}>

            {}
            {status.mediaUrl && (
                <StatusMedia url={status.mediaUrl} style={p.cardImg} />
            )}

            {}
            {status.content && (
                <p style={p.cardText}>{status.content}</p>
            )}

            {}
            <div style={p.cardMeta}>
                <span>{timeAgo(status.createdAt)}</span>
                <span>👁 {viewers.length > 0 ? viewers.length : (status.viewCount ?? 0)}</span>
                <span style={{ color: "var(--c-border3)", marginLeft: "auto" }}>
                    expires {timeAgo(new Date(status.expiresAt))} from now
                </span>
                <button style={p.delBtn} onClick={() => onDelete(status.id)} title="Delete">🗑</button>
            </div>

            {}
            {viewers.length > 0 && (
                <div style={p.viewerSection}>
                    <span style={p.viewerSectionLabel}>Seen by</span>
                    {viewers.map(vr => (
                        <div key={vr.viewerId} style={p.viewerChip}>
                            <img
                                src={avatarSrc(vr.viewerName, vr.viewerAvatarUrl)}
                                alt={vr.viewerName}
                                style={p.chipAvatar}
                            />
                            <div style={p.chipInfo}>
                                <span style={p.chipName}>{vr.viewerName}</span>
                                <span style={p.chipTime}>{timeAgo(vr.viewedAt)}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function StatusViewer({ statuses, onClose }) {
    const { addListener } = useSocket();
    const [idx, setIdx]       = useState(0);
    const [viewers, setViewers] = useState([]);
    const [reply, setReply]   = useState("");
    const [sending, setSending] = useState(false);
    const [sent, setSent]     = useState(false);

    const current = statuses[idx];

    useEffect(() => {
        const off = addListener("statusView", (event) => {
            if (current && event.statusId === current.id) {
                getStatusViewers(current.id).then(setViewers).catch(() => {});
            }
        });
        return off;
    }, [addListener, current]);

    useEffect(() => {
        if (current && !current.viewedByMe) {
            viewStatus(current.id).catch(() => {});
        }
    }, [current]);

    useEffect(() => {
        setViewers([]);
        setReply("");
        setSent(false);
        if (current?.viewCount != null) {
            getStatusViewers(current.id).then(setViewers).catch(() => {});
        }
    }, [current]);

    if (!current) return null;

    const goNext = () => idx < statuses.length - 1 ? setIdx(idx + 1) : onClose();
    const goPrev = () => idx > 0 && setIdx(idx - 1);

    const handleReply = async () => {
        const text = reply.trim();
        if (!text || sending) return;
        setSending(true);
        try {
            await replyToStatus(current.id, text);
            setReply("");
            setSent(true);
            setTimeout(() => setSent(false), 3000);
        } catch {  }
        finally { setSending(false); }
    };

    return (
        <div style={v.backdrop} onClick={onClose}>
            <div style={v.card} onClick={e => e.stopPropagation()}>

                {}
                <div style={v.progress}>
                    {statuses.map((_, i) => (
                        <div key={i} style={{
                            flex: 1, height: 3, borderRadius: 2,
                            background: i <= idx ? "var(--c-text)" : "var(--c-border3)",
                        }} />
                    ))}
                </div>

                {}
                <div style={v.header}>
                    <RingAvatar name={current.authorName} url={current.authorAvatarUrl} hasUnread={false} size={34} />
                    <div style={{ marginLeft: 10, flex: 1 }}>
                        <div style={v.name}>{current.authorName}</div>
                        <div style={v.ts}>{timeAgo(current.createdAt)}</div>
                    </div>
                    <button style={v.closeBtn} onClick={onClose}>✕</button>
                </div>

                {}
                {current.mediaUrl && (
                    <div style={v.mediaWrap}>
                        <StatusMedia url={current.mediaUrl} style={v.media} />
                    </div>
                )}

                {}
                {current.content && (
                    <div style={{
                        ...v.textBox,
                        marginTop: current.mediaUrl ? 0 : 8,
                        borderRadius: current.mediaUrl ? "0 0 8px 8px" : 8,
                    }}>
                        <p style={v.text}>{current.content}</p>
                    </div>
                )}

                {}
                {current.viewCount != null && (
                    <div style={v.seenSection}>

                        {}
                        <div style={v.seenHeader}>
                            <span style={v.eyeIcon}>👁</span>
                            <span style={v.seenCount}>
                                {viewers.length > 0 ? viewers.length : current.viewCount}{" "}
                                {(viewers.length > 0 ? viewers.length : current.viewCount) === 1 ? "view" : "views"}
                            </span>
                        </div>

                        {}
                        {viewers.length === 0 && current.viewCount === 0 && (
                            <p style={v.hint}>No views yet</p>
                        )}
                        {viewers.length === 0 && current.viewCount > 0 && (
                            <p style={v.hint}>Loading…</p>
                        )}
                        {viewers.map(vr => (
                            <div key={vr.viewerId} style={v.viewerRow}>
                                <img
                                    src={avatarSrc(vr.viewerName, vr.viewerAvatarUrl)}
                                    alt={vr.viewerName}
                                    style={v.viewerAvatar}
                                />
                                <div style={v.viewerInfo}>
                                    <span style={v.viewerName}>{vr.viewerName}</span>
                                    <span style={v.viewerTime}>{timeAgo(vr.viewedAt)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {}
                {current.viewCount == null && (
                    <div style={v.replyBar}>
                        {sent ? (
                            <div style={v.sentMsg}>✓ Reply sent — check your chat</div>
                        ) : (
                            <>
                                <input
                                    style={v.replyInput}
                                    value={reply}
                                    onChange={e => setReply(e.target.value)}
                                    onKeyDown={e => e.key === "Enter" && handleReply()}
                                    placeholder={`Reply to ${current.authorName}…`}
                                    maxLength={1000}
                                    disabled={sending}
                                />
                                <button
                                    style={{ ...v.replyBtn, opacity: reply.trim() ? 1 : 0.4 }}
                                    onClick={handleReply}
                                    disabled={!reply.trim() || sending}
                                >
                                    {sending ? "..." : "↩ Send"}
                                </button>
                            </>
                        )}
                    </div>
                )}

                {}
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

function ComposeForm({ onPosted, onCancel }) {
    const [text, setText] = useState("");
    const [imageFile, setImageFile]   = useState(null);
    const [preview, setPreview]       = useState(null);
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

        if (imageFile) {
            setUploading(true);
            try {
                mediaUrl = await uploadStatusMedia(imageFile);
            } catch (err) {
                setError(err.response?.data?.message || "Upload failed.");
                setUploading(false);
                return;
            }
            setUploading(false);
        }

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

    const statusLabel = uploading ? "Uploading…"
                      : posting   ? "Posting…"
                      : "Post";

    return (
        <div style={c.box}>

            {}
            {preview && (
                <div style={c.previewWrap}>
                    {imageFile && imageFile.type.startsWith("video/") ? (
                        <video src={preview} controls style={c.preview} />
                    ) : (
                        <img src={preview} alt="preview" style={c.preview} />
                    )}
                    <button style={c.removeImg} onClick={removeImage} title="Remove">✕</button>
                </div>
            )}

            {}
            <textarea
                style={c.textarea}
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder={imageFile ? "Add a caption… (optional)" : "What's on your mind?"}
                maxLength={700}
                rows={3}
                autoFocus={!imageFile}
            />

            {}
            <div style={c.row}>
                {}
                <button
                    style={c.imgBtn}
                    onClick={() => fileRef.current.click()}
                    title="Add photo or video"
                    disabled={posting || uploading}
                >
                    🖼
                </button>
                <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,video/ogg"
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

export default function StatusPage() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [myStatuses,      setMyStatuses]      = useState([]);
    const [contactStatuses, setContactStatuses] = useState([]);
    const [loading,  setLoading]  = useState(true);
    const [error,    setError]    = useState("");
    const [composing, setComposing] = useState(false);
    const [viewer,    setViewer]    = useState(null);

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
        } catch {  }
    };

    return (
        <div style={p.page}>
            <style>{css}</style>

            <div style={p.sidebar}>

                <div style={p.sidebarHeader}>
                    <h2 style={p.title}>Status</h2>
                </div>

                {loading && <p style={p.hint}>Loading…</p>}
                {error   && <p style={p.errText}>{error}</p>}

                {}
                <div style={p.section}>
                    <div style={p.label}>MY STATUS</div>

                    <div style={p.row} className="st-row"
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

                {}
                {grouped.length > 0 && (
                    <div style={p.section}>
                        <div style={p.label}>RECENT UPDATES</div>
                        {grouped.map(g => (
                            <div key={g.authorId} style={p.row} className="st-row"
                                onClick={() => setViewer(
                                    [...g.items].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
                                )}>
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

            {}
            <div style={p.main}>
                {myStatuses.length === 0 ? (
                    <div style={p.empty}>
                        <svg viewBox="0 0 24 24" width="46" height="46" fill="none" stroke="var(--c-border3)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="9" strokeDasharray="4 3" />
                            <circle cx="12" cy="12" r="3" />
                        </svg>
                        <p style={p.emptyText}>No active statuses</p>
                        <button style={p.postFirstBtn} className="pulse-btn" onClick={() => setComposing(true)}>
                            + Post your status now!
                        </button>
                    </div>
                ) : (
                    <div style={p.cardList}>
                        <h3 style={p.cardListTitle}>Your active statuses</h3>
                        {myStatuses.map(s => (
                            <StatusCard key={s.id} status={s} onDelete={handleDelete} />
                        ))}
                    </div>
                )}
            </div>

            {}
            {viewer && (
                <StatusViewer
                    statuses={viewer}
                    onClose={() => { setViewer(null); load(); }}
                />
            )}
        </div>
    );
}

const v = {
    backdrop: {
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.88)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000,
    },
    card: {
        background: "var(--c-surface6)", borderRadius: 12,
        width: 400, maxWidth: "95vw",
        padding: "16px 20px 20px",
        display: "flex", flexDirection: "column", gap: 12,
    },
    progress: { display: "flex", gap: 4 },
    header:   { display: "flex", alignItems: "center" },
    name:     { fontSize: 15, fontWeight: 600, color: "var(--c-text)" },
    ts:       { fontSize: 12, color: "var(--c-muted)" },
    closeBtn: { marginLeft: "auto", background: "none", border: "none", color: "var(--c-muted)", fontSize: 18, cursor: "pointer" },
    mediaWrap:{ borderRadius: 8, overflow: "hidden", maxHeight: 320, display:"flex", alignItems:"center", justifyContent:"center", background:"#000" },
    media:    { width: "100%", maxHeight: 320, objectFit: "contain" },
    textBox:  { background: "var(--c-border2)", padding: "14px 16px" },
    text:     { fontSize: 18, color: "var(--c-text)", margin: 0, textAlign: "center", whiteSpace: "pre-wrap", wordBreak: "break-word" },
    views:    { fontSize: 13, color: "var(--c-muted)", textAlign: "right" },
    seenSection: { borderTop: "1px solid var(--c-border2)", paddingTop: 10, display: "flex", flexDirection: "column", gap: 4, maxHeight: 200, overflowY: "auto" },
    seenHeader:  { display: "flex", alignItems: "center", gap: 6, marginBottom: 4 },
    eyeIcon:     { fontSize: 14 },
    seenCount:   { fontSize: 13, fontWeight: 600, color: "var(--c-text)" },
    viewerRow:   { display: "flex", alignItems: "center", gap: 10, padding: "5px 2px", borderRadius: 6 },
    viewerAvatar:{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover", flexShrink: 0 },
    viewerInfo:  { display: "flex", alignItems: "center", gap: 6 },
    viewerName:  { fontSize: 13, color: "var(--c-text)", fontWeight: 500 },
    viewerTime:  { fontSize: 11, color: "var(--c-muted)" },
    hint:        { fontSize: 12, color: "var(--c-muted)", margin: "2px 0", padding: "0 2px" },
    nav:      { display: "flex", alignItems: "center", justifyContent: "space-between" },
    navBtn:   { background: "var(--c-border2)", border: "none", borderRadius: 6, color: "var(--c-text)", padding: "8px 14px", cursor: "pointer", fontSize: 13 },
    counter:  { fontSize: 13, color: "var(--c-muted)" },
    replyBar: { display: "flex", alignItems: "center", gap: 8, borderTop: "1px solid var(--c-border2)", paddingTop: 10 },
    replyInput: { flex: 1, background: "var(--c-border2)", border: "1px solid var(--c-border3)", borderRadius: 20, color: "var(--c-text)", fontSize: 14, padding: "8px 14px", outline: "none", fontFamily: "inherit" },
    replyBtn:   { background: "var(--c-accent)", border: "none", borderRadius: 20, color: "#fff", padding: "8px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" },
    sentMsg:    { fontSize: 13, color: "var(--c-accent)", fontWeight: 500, textAlign: "center", width: "100%", padding: "4px 0" },
};

const c = {
    box:        { margin: "0 12px 12px", background: "var(--c-surface6)", borderRadius: 8, padding: 12, display: "flex", flexDirection: "column", gap: 8 },
    previewWrap:{ position: "relative", borderRadius: 6, overflow: "hidden" },
    preview:    { width: "100%", maxHeight: 160, objectFit: "cover", display: "block", borderRadius: 6 },
    removeImg:  { position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.6)", border: "none", color: "#fff", borderRadius: "50%", width: 24, height: 24, cursor: "pointer", fontSize: 13, lineHeight: "24px", textAlign: "center", padding: 0 },
    textarea:   { width: "100%", boxSizing: "border-box", background: "var(--c-border2)", border: "1px solid var(--c-border3)", borderRadius: 6, color: "var(--c-text)", fontSize: 14, padding: "8px 10px", resize: "none", outline: "none", fontFamily: "inherit" },
    row:        { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" },
    imgBtn:     { background: "none", border: "1px solid var(--c-border3)", borderRadius: 6, color: "var(--c-muted)", padding: "4px 8px", cursor: "pointer", fontSize: 16 },
    chars:      { fontSize: 11, color: "var(--c-muted)" },
    err:        { fontSize: 12, color: "#ff6b6b", flex: 1 },
    cancelBtn:  { background: "none", border: "1px solid var(--c-border3)", borderRadius: 6, color: "var(--c-muted)", padding: "6px 10px", cursor: "pointer", fontSize: 12 },
    postBtn:    { background: "var(--c-accent)", border: "none", borderRadius: 6, color: "#fff", padding: "6px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600, marginLeft: "auto" },
};

const p = {
    page:          { display: "flex", height: "100vh", background: "var(--c-bg)", color: "var(--c-text)" },
    sidebar:       { width: 300, borderRight: "1px solid var(--c-surface)", background: "var(--c-panel)", overflowY: "auto", display: "flex", flexDirection: "column" },
    sidebarHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 16px 8px" },
    title:         { fontSize: 18, margin: 0, color: "var(--c-text)" },
    backBtn:       { background: "none", border: "none", color: "var(--c-accent)", fontSize: 13, cursor: "pointer" },
    section:       { borderBottom: "1px solid var(--c-surface)", paddingBottom: 8 },
    label:         { fontSize: 11, letterSpacing: "0.5px", color: "var(--c-muted)", padding: "12px 16px 4px" },
    row:           { display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", cursor: "pointer" },
    info:          { display: "flex", flexDirection: "column", gap: 2 },
    rowName:       { fontSize: 15, fontWeight: 500, color: "var(--c-text)" },
    rowSub:        { fontSize: 12, color: "var(--c-muted)" },
    newBadge:      { color: "var(--c-accent)", fontWeight: 600 },
    addDot:        { position: "absolute", bottom: -2, right: -2, width: 20, height: 20, borderRadius: "50%", background: "var(--c-accent)", border: "2px solid var(--c-panel)", color: "#fff", fontSize: 16, lineHeight: "16px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 },
    hint:          { fontSize: 13, color: "var(--c-muted)", padding: "12px 16px" },
    errText:       { fontSize: 13, color: "#ff6b6b", padding: "12px 16px" },
    main:          { flex: 1, overflowY: "auto", background: "radial-gradient(1000px 700px at 85% -8%, rgba(74,157,137,0.06), transparent 60%), var(--c-bg)", display: "flex", alignItems: "flex-start", justifyContent: "center" },
    empty:         { display: "flex", flexDirection: "column", alignItems: "center", gap: 16, marginTop: 120 },
    emptyText:     { fontSize: 15, color: "var(--c-muted)", margin: 0 },
    postFirstBtn:  { background: "var(--c-accent)", border: "none", borderRadius: 8, color: "#fff", padding: "12px 24px", fontSize: 15, cursor: "pointer" },
    cardList:      { width: "100%", maxWidth: 580, padding: 24, display: "flex", flexDirection: "column", gap: 12 },
    cardListTitle: { fontSize: 17, color: "var(--c-text)", margin: "0 0 6px", fontWeight: 600 },
    card:          { background: "var(--c-panel)", border: "1px solid var(--c-border)", borderRadius: 16, overflow: "hidden", boxShadow: "var(--c-shadow-soft)" },
    cardImg:       { width: "100%", maxHeight: 260, objectFit: "cover", display: "block" },
    cardText:      { fontSize: 16, color: "var(--c-text)", margin: 0, padding: "14px 16px", whiteSpace: "pre-wrap", wordBreak: "break-word" },
    cardMeta:      { display: "flex", alignItems: "center", gap: 14, padding: "10px 16px", fontSize: 12, color: "var(--c-muted)", borderTop: "1px solid var(--c-border2)" },
    delBtn:        { background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "var(--c-muted)" },
    viewerSection: { display: "flex", flexDirection: "column", gap: 2, padding: "8px 16px 12px", borderTop: "1px solid var(--c-border2)" },
    viewerSectionLabel: { fontSize: 11, color: "var(--c-muted)", letterSpacing: "0.4px", marginBottom: 4 },
    viewerChip:    { display: "flex", alignItems: "center", gap: 10, padding: "5px 0" },
    chipAvatar:    { width: 28, height: 28, borderRadius: "50%", objectFit: "cover", flexShrink: 0 },
    chipInfo:      { display: "flex", alignItems: "center", gap: 8 },
    chipName:      { fontSize: 13, color: "var(--c-text)", fontWeight: 500 },
    chipTime:      { fontSize: 11, color: "var(--c-muted)" },
};

const css = `
.st-row:hover { background: var(--c-surface3); }
.pulse-btn:hover { background: var(--c-accent-hover) !important; }
`;
