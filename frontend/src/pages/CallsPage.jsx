import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getCallLogs } from "../api/callApi";
import { deleteForMe } from "../api/messageActionApi";
import { useCall } from "../context/CallContext";

function formatDuration(totalSeconds) {
    const s = Number(totalSeconds) || 0;
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, "0")}`;
}

function formatWhen(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    if (sameDay) return time;
    return `${d.toLocaleDateString([], { day: "numeric", month: "short" })}, ${time}`;
}

function DirectionIcon({ direction, missed, declined }) {
    const color = missed || declined ? "#f15c6d" : "var(--c-online, #25d366)";
    // Outgoing = up-right arrow, Incoming = down-left arrow.
    const path = direction === "OUTGOING"
        ? "M7 17L17 7M17 7H8M17 7V16"
        : "M17 7L7 17M7 17H16M7 17V8";
    return (
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d={path} />
        </svg>
    );
}

function TypeIcon({ video }) {
    return video ? (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 7l-7 5 7 5V7z" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
        </svg>
    ) : (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
    );
}

export default function CallsPage() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const navigate = useNavigate();
    const { startCall } = useCall();

    useEffect(() => {
        getCallLogs()
            .then((data) => setLogs(data || []))
            .catch(() => setError("Could not load call logs."))
            .finally(() => setLoading(false));
    }, []);

    const subtitle = (log) => {
        const missed = log.status === "MISSED";
        const declined = log.status === "DECLINED";
        if (declined) return "Declined";
        if (missed) return log.direction === "OUTGOING" ? "No answer" : "Missed";
        if (log.durationSec > 0) return formatDuration(log.durationSec);
        return "Completed";
    };

    const openChat = (log) => {
        sessionStorage.setItem("pulse_selected", JSON.stringify({ type: "dm", userId: log.peerUserId }));
        navigate("/chat");
    };

    const handleDelete = async (log) => {
        // The call log IS a message, so delete-for-me hides it from the log and
        // the conversation in one go.
        try {
            await deleteForMe(log.id);
            setLogs((prev) => prev.filter((l) => l.id !== log.id));
        } catch {
            setError("Could not delete that call.");
        }
    };

    return (
        <div style={styles.page}>
            <style>{css}</style>
            <div style={styles.card}>
                <div style={styles.header}>
                    <h1 style={styles.title}>Calls</h1>
                </div>

                {error && <div style={styles.error}>{error}</div>}

                {loading ? (
                    <div style={styles.center}>Loading…</div>
                ) : logs.length === 0 ? (
                    <div style={styles.empty}>No calls yet.</div>
                ) : (
                    <div style={styles.list}>
                        {logs.map((log) => {
                            const missed = log.status === "MISSED";
                            const declined = log.status === "DECLINED";
                            const isVideo = log.mediaType === "VIDEO";
                            const nameColor = missed ? "#f15c6d" : "var(--c-text)";
                            return (
                                <div key={log.id} style={styles.row}>
                                    <button style={styles.rowMain} className="pulse-callrow" onClick={() => openChat(log)}>
                                        {log.peerAvatarUrl ? (
                                            <img src={log.peerAvatarUrl} alt="" style={styles.avatar} />
                                        ) : (
                                            <span style={styles.avatarFallback}>
                                                {(log.peerName || "?").charAt(0).toUpperCase()}
                                            </span>
                                        )}
                                        <div style={styles.info}>
                                            <span style={{ ...styles.name, color: nameColor }}>{log.peerName}</span>
                                            <span style={styles.sub}>
                                                <DirectionIcon direction={log.direction} missed={missed} declined={declined} />
                                                <span>{subtitle(log)}</span>
                                            </span>
                                        </div>
                                        <div style={styles.right}>
                                            <span style={styles.typeIcon}><TypeIcon video={isVideo} /></span>
                                            <span style={styles.when}>{formatWhen(log.createdAt)}</span>
                                        </div>
                                    </button>
                                    <button
                                        style={styles.callBackBtn}
                                        className="pulse-callback"
                                        aria-label={isVideo ? "Video call" : "Voice call"}
                                        title={isVideo ? "Video call back" : "Voice call back"}
                                        onClick={() => startCall(
                                            { userId: log.peerUserId, name: log.peerName, avatarUrl: log.peerAvatarUrl },
                                            isVideo ? "VIDEO" : "AUDIO",
                                        )}
                                    >
                                        <TypeIcon video={isVideo} />
                                    </button>
                                    <button
                                        style={styles.deleteBtn}
                                        className="pulse-calldelete"
                                        aria-label="Delete call"
                                        title="Delete from logs and chat"
                                        onClick={() => handleDelete(log)}
                                    >
                                        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="3 6 5 6 21 6" />
                                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                            <path d="M10 11v6M14 11v6" />
                                            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                                        </svg>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

const styles = {
    page: { height: "100%", overflowY: "auto", background: "var(--c-bg)", color: "var(--c-text)", padding: "24px" },
    card: { maxWidth: "640px", margin: "0 auto" },
    header: { marginBottom: "16px" },
    title: { fontSize: "22px", fontWeight: 700, margin: 0 },
    error: { color: "#f15c6d", marginBottom: "12px" },
    center: { padding: "40px", textAlign: "center", color: "var(--c-muted)" },
    empty: { padding: "40px", textAlign: "center", color: "var(--c-muted)" },
    list: { display: "flex", flexDirection: "column", gap: "2px" },
    row: { display: "flex", alignItems: "center", gap: "4px" },
    rowMain: {
        flex: 1,
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "10px 12px",
        background: "transparent",
        border: "none",
        borderRadius: "12px",
        cursor: "pointer",
        textAlign: "left",
        color: "inherit",
    },
    avatar: { width: "44px", height: "44px", borderRadius: "50%", objectFit: "cover", flex: "0 0 auto" },
    avatarFallback: {
        width: "44px", height: "44px", borderRadius: "50%", background: "var(--c-border2)",
        color: "var(--c-text)", display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 600, fontSize: "17px", flex: "0 0 auto",
    },
    info: { display: "flex", flexDirection: "column", gap: "2px", minWidth: 0, flex: 1 },
    name: { fontWeight: 600, fontSize: "15px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    sub: { display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "13px", color: "var(--c-muted)" },
    right: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "3px", flex: "0 0 auto" },
    typeIcon: { color: "var(--c-muted)", display: "inline-flex" },
    when: { fontSize: "12px", color: "var(--c-muted)" },
    callBackBtn: {
        width: "40px", height: "40px", borderRadius: "50%", flex: "0 0 auto",
        border: "1px solid var(--c-border)", background: "transparent",
        color: "var(--c-online, #25d366)", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
    },
    deleteBtn: {
        width: "40px", height: "40px", borderRadius: "50%", flex: "0 0 auto",
        border: "1px solid var(--c-border)", background: "transparent",
        color: "var(--c-muted)", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
    },
};

const css = `
.pulse-callrow:hover { background: var(--c-surface); }
.pulse-callback:hover { background: var(--c-surface); }
.pulse-calldelete:hover { background: var(--c-surface); color: #f15c6d; }
`;
