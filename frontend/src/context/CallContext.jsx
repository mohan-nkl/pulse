import {
    createContext,
    useContext,
    useEffect,
    useRef,
    useState,
    useCallback,
} from "react";
import { useAuth } from "./AuthContext";
import { useSocket } from "./SocketContext";
import { sendCallSignal } from "../services/WebSocket";
import { RTC_CONFIG, RING_TIMEOUT_MS } from "../services/callConfig";
import { startIncomingRing, startRingback, stop as stopRing } from "../services/ringtone";
import { logCall } from "../api/callApi";
import CallOverlay from "../components/CallOverlay";

const CallContext = createContext(null);

// Call lifecycle, as seen by this client:
//   idle       - nothing happening
//   outgoing   - we placed a call, waiting for the other side to pick up
//   incoming   - someone is calling us, ringing
//   connecting - both sides agreed; ICE/DTLS handshake in flight
//   active     - media connected, talking
//   ended      - terminal screen shown briefly, then back to idle
const STATUS = {
    IDLE: "idle",
    OUTGOING: "outgoing",
    INCOMING: "incoming",
    CONNECTING: "connecting",
    ACTIVE: "active",
    ENDED: "ended",
};

const AUDIO = "AUDIO";
const VIDEO = "VIDEO";

function newCallId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `call_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function CallProvider({ children }) {
    const { user } = useAuth();
    const { addListener, presence } = useSocket();

    const [status, setStatus] = useState(STATUS.IDLE);
    const [peer, setPeer] = useState(null);        // { userId, name, avatarUrl }
    const [muted, setMuted] = useState(false);
    const [cameraOff, setCameraOff] = useState(false);
    const [isVideo, setIsVideo] = useState(false);
    const [durationSec, setDurationSec] = useState(0);
    const [endReason, setEndReason] = useState(null); // "busy" | "unavailable" | "ended" | "declined" | "missed" | "failed"

    // The two media streams are kept in state so the overlay can bind them to
    // its own <video>/<audio> elements. The audio call path uses these too —
    // a hidden <audio> still needs the remote stream to be heard.
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);

    // Refs hold the live WebRTC objects and the latest values the signal
    // handler needs, so that handler can stay registered once without going
    // stale against React state.
    const pcRef = useRef(null);
    const localStreamRef = useRef(null);
    const callIdRef = useRef(null);
    const peerIdRef = useRef(null);
    const statusRef = useRef(STATUS.IDLE);
    const mediaTypeRef = useRef(AUDIO);        // media type of the CURRENT call
    const incomingMediaRef = useRef(AUDIO);    // media type carried on a ringing offer
    const pendingIceRef = useRef([]);          // ICE that arrived before remoteDescription
    const remoteReadyRef = useRef(false);      // has setRemoteDescription completed
    const incomingOfferRef = useRef(null);     // stored SDP offer while ringing
    const ringTimerRef = useRef(null);
    const durationTimerRef = useRef(null);
    const isCallerRef = useRef(false);      // did this client place the call?
    const connectedRef = useRef(false);     // did media ever connect?
    const activeStartRef = useRef(null);    // ms timestamp when the call went active

    const setStatusSafe = useCallback((next) => {
        statusRef.current = next;
        setStatus(next);
    }, []);

    // ---- teardown -----------------------------------------------------------

    const stopDurationTimer = useCallback(() => {
        if (durationTimerRef.current) {
            clearInterval(durationTimerRef.current);
            durationTimerRef.current = null;
        }
    }, []);

    const clearRingTimeout = useCallback(() => {
        if (ringTimerRef.current) {
            clearTimeout(ringTimerRef.current);
            ringTimerRef.current = null;
        }
    }, []);

    const teardownMedia = useCallback(() => {
        stopRing();
        clearRingTimeout();
        stopDurationTimer();

        if (pcRef.current) {
            try {
                pcRef.current.onicecandidate = null;
                pcRef.current.ontrack = null;
                pcRef.current.onconnectionstatechange = null;
                pcRef.current.close();
            } catch { /* already closed */ }
            pcRef.current = null;
        }

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((t) => {
                try { t.stop(); } catch { /* ignore */ }
            });
            localStreamRef.current = null;
        }

        setLocalStream(null);
        setRemoteStream(null);

        pendingIceRef.current = [];
        remoteReadyRef.current = false;
        incomingOfferRef.current = null;
        callIdRef.current = null;
        peerIdRef.current = null;
        mediaTypeRef.current = AUDIO;
        incomingMediaRef.current = AUDIO;
        isCallerRef.current = false;
        connectedRef.current = false;
        activeStartRef.current = null;
    }, [clearRingTimeout, stopDurationTimer]);

    /** End the call locally and flash an "ended" screen, then return to idle. */
    const finishWith = useCallback((reason) => {
        // Only the caller records the call — one record per call. A local
        // failure (mic/camera denied, never reached the other side) isn't a
        // real call, so it's not logged.
        if (isCallerRef.current && reason !== "failed" && peerIdRef.current) {
            const connected = connectedRef.current;
            let logStatus;
            if (reason === "declined") {
                logStatus = "DECLINED";
            } else if (connected) {
                logStatus = "COMPLETED";
            } else {
                logStatus = "MISSED";
            }
            const durationSec = connected && activeStartRef.current
                ? Math.max(0, Math.round((Date.now() - activeStartRef.current) / 1000))
                : 0;

            logCall({
                calleeId: peerIdRef.current,
                mediaType: mediaTypeRef.current,
                status: logStatus,
                durationSec,
            }).catch(() => { /* logging is best-effort */ });
        }

        teardownMedia();
        setMuted(false);
        setCameraOff(false);
        setDurationSec(0);
        setEndReason(reason);
        setStatusSafe(STATUS.ENDED);

        setTimeout(() => {
            // Only reset if nothing new started in the meantime.
            if (statusRef.current === STATUS.ENDED) {
                setStatusSafe(STATUS.IDLE);
                setPeer(null);
                setEndReason(null);
                setIsVideo(false);
            }
        }, 1800);
    }, [teardownMedia, setStatusSafe]);

    const signal = useCallback((type, extra = {}) => {
        if (!peerIdRef.current) return;
        sendCallSignal({
            toUserId: peerIdRef.current,
            type,
            callId: callIdRef.current,
            callType: mediaTypeRef.current,
            ...extra,
        });
    }, []);

    // ---- peer connection plumbing ------------------------------------------

    const startDurationTimer = useCallback(() => {
        if (durationTimerRef.current) return;
        durationTimerRef.current = setInterval(() => {
            setDurationSec((s) => s + 1);
        }, 1000);
    }, []);

    const createPeerConnection = useCallback(() => {
        const pc = new RTCPeerConnection(RTC_CONFIG);

        pc.onicecandidate = (e) => {
            if (e.candidate) {
                signal("ICE", { candidate: e.candidate.toJSON() });
            }
        };

        pc.ontrack = (e) => {
            stopRing();
            setRemoteStream(e.streams[0]);
        };

        pc.onconnectionstatechange = () => {
            const st = pc.connectionState;
            if (st === "connected") {
                stopRing();
                clearRingTimeout();
                connectedRef.current = true;
                if (!activeStartRef.current) {
                    activeStartRef.current = Date.now();
                }
                setStatusSafe(STATUS.ACTIVE);
                startDurationTimer();
            } else if (st === "failed") {
                finishWith("failed");
            }
            // "disconnected" can be transient; we let the server's
            // disconnect-driven HANGUP (or an explicit hang-up) end the call.
        };

        pcRef.current = pc;
        return pc;
    }, [signal, startDurationTimer, clearRingTimeout, setStatusSafe, finishWith]);

    const getLocalMedia = useCallback(async (wantVideo) => {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: wantVideo,
        });
        localStreamRef.current = stream;
        setLocalStream(stream);
        return stream;
    }, []);

    const addLocalTracks = useCallback((pc, stream) => {
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    }, []);

    const flushPendingIce = useCallback(async () => {
        remoteReadyRef.current = true;
        const queued = pendingIceRef.current;
        pendingIceRef.current = [];
        for (const candidate of queued) {
            try {
                await pcRef.current?.addIceCandidate(candidate);
            } catch { /* candidate no longer applicable */ }
        }
    }, []);

    // ---- public actions -----------------------------------------------------

    const startCall = useCallback(async (target, mediaType = AUDIO) => {
        if (statusRef.current !== STATUS.IDLE) return;
        if (!target?.userId) return;

        const wantVideo = mediaType === VIDEO;
        const callId = newCallId();
        callIdRef.current = callId;
        peerIdRef.current = target.userId;
        mediaTypeRef.current = wantVideo ? VIDEO : AUDIO;
        isCallerRef.current = true;
        setPeer(target);
        setIsVideo(wantVideo);
        setEndReason(null);
        setStatusSafe(STATUS.OUTGOING);

        try {
            const stream = await getLocalMedia(wantVideo);
            const pc = createPeerConnection();
            addLocalTracks(pc, stream);

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            signal("OFFER", { sdp: pc.localDescription.toJSON?.() ?? pc.localDescription });
            startRingback();

            clearRingTimeout();
            ringTimerRef.current = setTimeout(() => {
                if (statusRef.current === STATUS.OUTGOING) {
                    signal("CANCEL");
                    finishWith("missed");
                }
            }, RING_TIMEOUT_MS);
        } catch {
            // Mic/camera permission denied or no device.
            signal("CANCEL");
            finishWith("failed");
        }
    }, [getLocalMedia, createPeerConnection, addLocalTracks, signal, clearRingTimeout, finishWith, setStatusSafe]);

    const acceptCall = useCallback(async () => {
        if (statusRef.current !== STATUS.INCOMING) return;
        const offer = incomingOfferRef.current;
        if (!offer) return;

        const wantVideo = incomingMediaRef.current === VIDEO;
        mediaTypeRef.current = wantVideo ? VIDEO : AUDIO;

        stopRing();
        setStatusSafe(STATUS.CONNECTING);

        try {
            const pc = createPeerConnection();
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            await flushPendingIce();

            const stream = await getLocalMedia(wantVideo);
            addLocalTracks(pc, stream);

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            signal("ANSWER", { sdp: pc.localDescription.toJSON?.() ?? pc.localDescription });
        } catch {
            signal("HANGUP");
            finishWith("failed");
        }
    }, [createPeerConnection, flushPendingIce, getLocalMedia, addLocalTracks, signal, finishWith, setStatusSafe]);

    const rejectCall = useCallback(() => {
        if (statusRef.current !== STATUS.INCOMING) return;
        signal("REJECT");
        finishWith("declined");
    }, [signal, finishWith]);

    const hangup = useCallback(() => {
        const st = statusRef.current;
        if (st === STATUS.OUTGOING) {
            signal("CANCEL");
        } else if (st === STATUS.CONNECTING || st === STATUS.ACTIVE) {
            signal("HANGUP");
        }
        finishWith("ended");
    }, [signal, finishWith]);

    const toggleMute = useCallback(() => {
        const stream = localStreamRef.current;
        if (!stream) return;
        const next = !muted;
        stream.getAudioTracks().forEach((t) => { t.enabled = !next; });
        setMuted(next);
    }, [muted]);

    const toggleCamera = useCallback(() => {
        const stream = localStreamRef.current;
        if (!stream) return;
        const next = !cameraOff;
        stream.getVideoTracks().forEach((t) => { t.enabled = !next; });
        setCameraOff(next);
    }, [cameraOff]);

    // ---- inbound signal handling -------------------------------------------

    const handleSignal = useCallback(async (event) => {
        const fromId = event.fromUserId;
        const type = event.type;

        // OFFER: someone is calling us.
        if (type === "OFFER") {
            // Already busy locally? Politely bounce so their UI updates fast.
            if (statusRef.current !== STATUS.IDLE) {
                sendCallSignal({ toUserId: fromId, type: "BUSY", callId: event.callId, callType: event.callType || AUDIO });
                return;
            }
            const offeredVideo = event.callType === VIDEO;
            callIdRef.current = event.callId;
            peerIdRef.current = fromId;
            incomingOfferRef.current = event.sdp;
            incomingMediaRef.current = offeredVideo ? VIDEO : AUDIO;
            isCallerRef.current = false;
            remoteReadyRef.current = false;
            pendingIceRef.current = [];
            setPeer({ userId: fromId, name: event.callerName || `User ${fromId}`, avatarUrl: event.callerAvatar || null });
            setIsVideo(offeredVideo);
            setEndReason(null);
            setStatusSafe(STATUS.INCOMING);
            startIncomingRing();
            return;
        }

        // Everything below should pertain to our current peer.
        if (peerIdRef.current && fromId !== peerIdRef.current) {
            // A stray signal from someone we're not in a call with.
            if (type === "OFFER") {
                sendCallSignal({ toUserId: fromId, type: "BUSY", callId: event.callId, callType: event.callType || AUDIO });
            }
            return;
        }

        if (type === "ANSWER") {
            if (statusRef.current !== STATUS.OUTGOING) return;
            stopRing();
            setStatusSafe(STATUS.CONNECTING);
            try {
                await pcRef.current?.setRemoteDescription(new RTCSessionDescription(event.sdp));
                await flushPendingIce();
            } catch {
                signal("HANGUP");
                finishWith("failed");
            }
            return;
        }

        if (type === "ICE") {
            if (!event.candidate) return;
            const candidate = new RTCIceCandidate(event.candidate);
            if (remoteReadyRef.current && pcRef.current) {
                try { await pcRef.current.addIceCandidate(candidate); } catch { /* ignore */ }
            } else {
                pendingIceRef.current.push(candidate);
            }
            return;
        }

        if (type === "BUSY") {
            finishWith("busy");
            return;
        }

        if (type === "UNAVAILABLE") {
            finishWith("unavailable");
            return;
        }

        if (type === "REJECT") {
            finishWith("declined");
            return;
        }

        if (type === "CANCEL") {
            // Caller gave up before we answered.
            finishWith("missed");
            return;
        }

        if (type === "HANGUP") {
            finishWith("ended");
            return;
        }
    }, [flushPendingIce, signal, finishWith, setStatusSafe]);

    useEffect(() => {
        if (!user) return undefined;
        const unsubscribe = addListener("call", (event) => { handleSignal(event); });
        return unsubscribe;
    }, [user, addListener, handleSignal]);

    // If the user logs out mid-call, tear everything down.
    useEffect(() => {
        if (!user && statusRef.current !== STATUS.IDLE) {
            teardownMedia();
            setStatusSafe(STATUS.IDLE);
            setPeer(null);
            setIsVideo(false);
        }
    }, [user, teardownMedia, setStatusSafe]);

    const peerOnline = peer ? Boolean(presence?.[peer.userId]?.online) : false;

    const value = {
        status,
        callActive: status !== STATUS.IDLE,
        startCall,
    };

    return (
        <CallContext.Provider value={value}>
            {children}
            <CallOverlay
                status={status}
                peer={peer}
                isVideo={isVideo}
                muted={muted}
                cameraOff={cameraOff}
                durationSec={durationSec}
                endReason={endReason}
                peerOnline={peerOnline}
                localStream={localStream}
                remoteStream={remoteStream}
                onAccept={acceptCall}
                onReject={rejectCall}
                onHangup={hangup}
                onToggleMute={toggleMute}
                onToggleCamera={toggleCamera}
            />
        </CallContext.Provider>
    );
}

export function useCall() {
    const ctx = useContext(CallContext);
    if (!ctx) {
        throw new Error("useCall must be used inside <CallProvider>");
    }
    return ctx;
}
