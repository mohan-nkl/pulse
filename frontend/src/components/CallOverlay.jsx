import { useEffect, useRef, useState } from "react";

const stroke = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
};

function PhoneIcon() {
    return (
        <svg viewBox="0 0 24 24" width="26" height="26" {...stroke}>
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
    );
}

function HangupIcon() {
    return (
        <svg viewBox="0 0 24 24" width="26" height="26" {...stroke}>
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" transform="rotate(135 12 12)" />
        </svg>
    );
}

function MicIcon({ off }) {
    return (
        <svg viewBox="0 0 24 24" width="22" height="22" {...stroke}>
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            {off && <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2" />}
        </svg>
    );
}

function CameraIcon({ off }) {
    return (
        <svg viewBox="0 0 24 24" width="22" height="22" {...stroke}>
            <path d="M23 7l-7 5 7 5V7z" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            {off && <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2" />}
        </svg>
    );
}

function formatDuration(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
}

function statusLine(status, durationSec, endReason, isVideo) {
    switch (status) {
        case "outgoing": return "Calling\u2026";
        case "incoming": return isVideo ? "Incoming video call" : "Incoming voice call";
        case "connecting": return "Connecting\u2026";
        case "active": return formatDuration(durationSec);
        case "ended":
            if (endReason === "busy") return "Busy";
            if (endReason === "unavailable") return "Unavailable";
            if (endReason === "declined") return "Call declined";
            if (endReason === "missed") return "No answer";
            if (endReason === "failed") return "Call failed";
            return "Call ended";
        default: return "";
    }
}

export default function CallOverlay({
                                        status,
                                        peer,
                                        isVideo,
                                        muted,
                                        cameraOff,
                                        durationSec,
                                        endReason,
                                        localStream,
                                        remoteStream,
                                        onAccept,
                                        onReject,
                                        onHangup,
                                        onToggleMute,
                                        onToggleCamera,
                                    }) {
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const remoteAudioRef = useRef(null);

    // The video stage is only used once media is actually flowing. While a
    // video call is still ringing we keep the avatar card.
    const videoStage = isVideo && (status === "connecting" || status === "active");

    // Bind the remote stream to whichever element is currently mounted.
    useEffect(() => {
        if (videoStage && remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream || null;
            const p = remoteVideoRef.current.play?.();
            if (p?.catch) p.catch(() => { /* autoplay guard */ });
        } else if (!videoStage && remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = remoteStream || null;
            const p = remoteAudioRef.current.play?.();
            if (p?.catch) p.catch(() => { /* autoplay guard */ });
        }
    }, [remoteStream, videoStage]);

    // Bind the local camera preview (video stage only).
    useEffect(() => {
        if (videoStage && localVideoRef.current) {
            localVideoRef.current.srcObject = localStream || null;
        }
    }, [localStream, videoStage]);

    // Drive a subtle pulsing ring while ringing/connecting (avatar card only).
    const [pulse, setPulse] = useState(false);
    useEffect(() => {
        if (!videoStage && (status === "outgoing" || status === "incoming" || status === "connecting")) {
            const id = setInterval(() => setPulse((p) => !p), 700);
            return () => clearInterval(id);
        }
        setPulse(false);
        return undefined;
    }, [status, videoStage]);

    // If the avatar URL is broken or expired, fall back to the initial rather
    // than showing the browser's broken-image glyph.
    const [avatarError, setAvatarError] = useState(false);
    useEffect(() => {
        setAvatarError(false);
    }, [peer?.userId, peer?.avatarUrl]);

    if (status === "idle" || !peer) return null;

    const initial = (peer.name || "?").charAt(0).toUpperCase();
    const isIncoming = status === "incoming";
    const isActive = status === "active";
    const showHangupRow = status === "outgoing" || status === "connecting" || status === "active";

    // ---- video stage --------------------------------------------------------
    if (videoStage) {
        return (
            <div style={styles.videoBackdrop}>
                <video ref={remoteVideoRef} autoPlay playsInline style={styles.remoteVideo} />

                <div style={styles.videoTopBar}>
                    <span style={styles.videoName}>{peer.name}</span>
                    <span style={styles.videoStatus}>{statusLine(status, durationSec, endReason, isVideo)}</span>
                </div>

                <div style={styles.localPreviewWrap}>
                    <video ref={localVideoRef} autoPlay playsInline muted style={styles.localVideo} />
                    {cameraOff && <div style={styles.localOff}>Camera off</div>}
                </div>

                <div style={styles.videoControls}>
                    <button
                        style={{ ...styles.roundBtn, ...styles.glassBtn, ...(muted ? styles.activeToggle : {}) }}
                        onClick={onToggleMute}
                        aria-label={muted ? "Unmute" : "Mute"}
                        title={muted ? "Unmute" : "Mute"}
                    >
                        <MicIcon off={muted} />
                    </button>
                    <button
                        style={{ ...styles.roundBtn, ...styles.glassBtn, ...(cameraOff ? styles.activeToggle : {}) }}
                        onClick={onToggleCamera}
                        aria-label={cameraOff ? "Turn camera on" : "Turn camera off"}
                        title={cameraOff ? "Turn camera on" : "Turn camera off"}
                    >
                        <CameraIcon off={cameraOff} />
                    </button>
                    <button
                        style={{ ...styles.roundBtn, ...styles.rejectBtn }}
                        onClick={onHangup}
                        aria-label="End call"
                        title="End call"
                    >
                        <HangupIcon />
                    </button>
                </div>
            </div>
        );
    }

    // ---- avatar card (audio calls, and video calls while still ringing) -----
    return (
        <div style={styles.backdrop}>
            {/* Audio still needs to be heard even with no visible video. */}
            <audio ref={remoteAudioRef} autoPlay playsInline />

            <div style={styles.card}>
                <div
                    style={{
                        ...styles.avatarRing,
                        boxShadow: pulse
                            ? "0 0 0 8px rgba(37,211,102,0.18)"
                            : "0 0 0 0 rgba(37,211,102,0.0)",
                    }}
                >
                    {peer.avatarUrl && !avatarError ? (
                        <img src={peer.avatarUrl} alt="" style={styles.avatar} onError={() => setAvatarError(true)} />
                    ) : (
                        <div style={styles.avatarFallback}>{initial}</div>
                    )}
                </div>

                <div style={styles.name}>{peer.name}</div>
                <div style={styles.status}>{statusLine(status, durationSec, endReason, isVideo)}</div>

                {isActive && (
                    <div style={styles.controlsRow}>
                        <button
                            style={{ ...styles.roundBtn, ...styles.neutralBtn, ...(muted ? styles.mutedBtn : {}) }}
                            onClick={onToggleMute}
                            aria-label={muted ? "Unmute" : "Mute"}
                            title={muted ? "Unmute" : "Mute"}
                        >
                            <MicIcon off={muted} />
                        </button>
                    </div>
                )}

                {isIncoming && (
                    <div style={styles.actionsRow}>
                        <button
                            style={{ ...styles.roundBtn, ...styles.rejectBtn }}
                            onClick={onReject}
                            aria-label="Decline"
                            title="Decline"
                        >
                            <HangupIcon />
                        </button>
                        <button
                            style={{ ...styles.roundBtn, ...styles.acceptBtn }}
                            onClick={onAccept}
                            aria-label="Accept"
                            title="Accept"
                        >
                            <PhoneIcon />
                        </button>
                    </div>
                )}

                {showHangupRow && (
                    <div style={styles.actionsRow}>
                        <button
                            style={{ ...styles.roundBtn, ...styles.rejectBtn }}
                            onClick={onHangup}
                            aria-label="End call"
                            title="End call"
                        >
                            <HangupIcon />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

const styles = {
    backdrop: {
        position: "fixed",
        inset: 0,
        zIndex: 4000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(3px)",
    },
    card: {
        width: "320px",
        maxWidth: "90vw",
        background: "var(--c-panel)",
        border: "1px solid var(--c-border)",
        borderRadius: "18px",
        padding: "32px 24px 28px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        boxShadow: "0 18px 50px rgba(0,0,0,0.35)",
    },
    avatarRing: {
        borderRadius: "50%",
        transition: "box-shadow 0.6s ease",
        marginBottom: "18px",
    },
    avatar: {
        width: "104px",
        height: "104px",
        borderRadius: "50%",
        objectFit: "cover",
        display: "block",
    },
    avatarFallback: {
        width: "104px",
        height: "104px",
        borderRadius: "50%",
        background: "var(--c-border2)",
        color: "var(--c-text)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "40px",
        fontWeight: 600,
    },
    name: {
        fontSize: "20px",
        fontWeight: 600,
        color: "var(--c-text)",
        textAlign: "center",
    },
    status: {
        fontSize: "14px",
        color: "var(--c-muted)",
        marginTop: "6px",
        minHeight: "18px",
        letterSpacing: "0.2px",
    },
    controlsRow: {
        display: "flex",
        gap: "16px",
        marginTop: "22px",
    },
    actionsRow: {
        display: "flex",
        gap: "40px",
        marginTop: "24px",
        justifyContent: "center",
    },
    roundBtn: {
        width: "58px",
        height: "58px",
        borderRadius: "50%",
        border: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        color: "#fff",
        transition: "transform 0.12s ease, filter 0.12s ease",
    },
    acceptBtn: { background: "var(--c-online, #25d366)" },
    rejectBtn: { background: "#f15c6d" },
    neutralBtn: { background: "var(--c-border2)", color: "var(--c-text)" },
    mutedBtn: { background: "#f15c6d", color: "#fff" },

    // ---- video stage ----
    videoBackdrop: {
        position: "fixed",
        inset: 0,
        zIndex: 4000,
        background: "#0b141a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
    },
    remoteVideo: {
        width: "100%",
        height: "100%",
        objectFit: "cover",
        background: "#0b141a",
    },
    videoTopBar: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: "2px",
        background: "linear-gradient(to bottom, rgba(0,0,0,0.45), rgba(0,0,0,0))",
        color: "#fff",
        pointerEvents: "none",
    },
    videoName: {
        fontSize: "18px",
        fontWeight: 600,
    },
    videoStatus: {
        fontSize: "13px",
        opacity: 0.85,
    },
    localPreviewWrap: {
        position: "absolute",
        top: "20px",
        right: "20px",
        width: "120px",
        height: "160px",
        borderRadius: "12px",
        overflow: "hidden",
        border: "2px solid rgba(255,255,255,0.25)",
        background: "#000",
        boxShadow: "0 6px 18px rgba(0,0,0,0.4)",
    },
    localVideo: {
        width: "100%",
        height: "100%",
        objectFit: "cover",
        transform: "scaleX(-1)", // mirror, like a selfie preview
    },
    localOff: {
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.7)",
        color: "#fff",
        fontSize: "12px",
    },
    videoControls: {
        position: "absolute",
        bottom: "32px",
        left: 0,
        right: 0,
        display: "flex",
        gap: "20px",
        justifyContent: "center",
    },
    glassBtn: {
        background: "rgba(255,255,255,0.18)",
        backdropFilter: "blur(6px)",
        color: "#fff",
    },
    activeToggle: {
        background: "#fff",
        color: "#0b141a",
    },
};
