import { useRef, useState, useEffect } from "react";

const stroke = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
};

function MicIcon() {
    return (
        <svg viewBox="0 0 24 24" width="20" height="20" {...stroke}>
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
        </svg>
    );
}

// Pick a recording format the current browser actually supports. Chrome/Firefox
// give webm/opus; Safari gives mp4. We record in whatever it offers and name
// the file to match, so the <audio> player can read it back.
function pickMimeType() {
    if (typeof MediaRecorder === "undefined") return "";
    const candidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus",
    ];
    for (const c of candidates) {
        if (MediaRecorder.isTypeSupported(c)) return c;
    }
    return "";
}

function extFor(mimeType) {
    if (mimeType.includes("mp4")) return "m4a";
    if (mimeType.includes("ogg")) return "ogg";
    return "webm";
}

function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
}

export default function VoiceRecorder({ disabled, onRecorded }) {
    const [recording, setRecording] = useState(false);
    const [seconds, setSeconds] = useState(0);

    const recorderRef = useRef(null);
    const chunksRef = useRef([]);
    const streamRef = useRef(null);
    const timerRef = useRef(null);
    const cancelledRef = useRef(false);

    const cleanup = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => {
                try { t.stop(); } catch { /* ignore */ }
            });
            streamRef.current = null;
        }
        recorderRef.current = null;
        chunksRef.current = [];
    };

    // Tear down the mic if the component unmounts mid-recording.
    useEffect(() => () => cleanup(), []);

    const start = async () => {
        if (disabled || recording) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            const mimeType = pickMimeType();
            const recorder = mimeType
                ? new MediaRecorder(stream, { mimeType })
                : new MediaRecorder(stream);
            recorderRef.current = recorder;
            chunksRef.current = [];
            cancelledRef.current = false;

            recorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
            };

            recorder.onstop = () => {
                const type = recorder.mimeType || "audio/webm";
                const blob = new Blob(chunksRef.current, { type });
                const wasCancelled = cancelledRef.current;

                cleanup();
                setRecording(false);
                setSeconds(0);

                if (!wasCancelled && blob.size > 0) {
                    const file = new File([blob], `voice-${Date.now()}.${extFor(type)}`, { type });
                    onRecorded(file);
                }
            };

            recorder.start();
            setRecording(true);
            setSeconds(0);
            timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
        } catch {
            // Mic permission denied or unavailable.
            cleanup();
            setRecording(false);
        }
    };

    const stopAndSend = () => {
        const recorder = recorderRef.current;
        if (!recorder) return;
        cancelledRef.current = false;
        try {
            recorder.stop();
        } catch {
            cleanup();
            setRecording(false);
        }
    };

    const cancel = () => {
        const recorder = recorderRef.current;
        cancelledRef.current = true;
        if (!recorder) {
            cleanup();
            setRecording(false);
            setSeconds(0);
            return;
        }
        try {
            recorder.stop();
        } catch {
            cleanup();
            setRecording(false);
            setSeconds(0);
        }
    };

    if (recording) {
        return (
            <div style={styles.bar}>
                <span style={styles.dot} />
                <span style={styles.timer}>{formatTime(seconds)}</span>
                <button
                    style={{ ...styles.iconBtn, ...styles.cancelBtn }}
                    onClick={cancel}
                    title="Cancel recording"
                    aria-label="Cancel recording"
                >
                    ✕
                </button>
                <button
                    style={{ ...styles.iconBtn, ...styles.sendBtn }}
                    onClick={stopAndSend}
                    title="Send voice message"
                    aria-label="Send voice message"
                >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                </button>
            </div>
        );
    }

    return (
        <button
            style={styles.micBtn}
            onClick={start}
            disabled={disabled}
            title="Record voice message"
            aria-label="Record voice message"
        >
            <MicIcon />
        </button>
    );
}

const styles = {
    micBtn: {
        background: "transparent",
        border: "none",
        color: "var(--c-muted)",
        cursor: "pointer",
        fontSize: "18px",
        padding: "8px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },
    bar: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "4px 8px",
        borderRadius: "20px",
        background: "var(--c-surface)",
    },
    dot: {
        width: "10px",
        height: "10px",
        borderRadius: "50%",
        background: "#f15c6d",
        animation: "pulse-rec 1s ease-in-out infinite",
    },
    timer: {
        fontVariantNumeric: "tabular-nums",
        fontSize: "13px",
        color: "var(--c-text)",
        minWidth: "34px",
    },
    iconBtn: {
        width: "34px",
        height: "34px",
        borderRadius: "50%",
        border: "none",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },
    cancelBtn: {
        background: "transparent",
        color: "var(--c-muted)",
        fontSize: "15px",
    },
    sendBtn: {
        background: "var(--c-accent)",
        color: "#fff",
    },
};
