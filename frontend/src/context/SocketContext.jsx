import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import NotificationToast from "../components/NotificationToast";
import { useAuth } from "./AuthContext";
import { useNotification } from "./NotificationContext";
import {
    connectWebSocket,
    disconnectWebSocket,
    sendDelivered,
} from "../services/WebSocket";

/*
 * SocketContext owns the ONE WebSocket connection for the whole app.
 *
 * Why it lives here and not in ChatPage:
 *   - Presence (online/offline) is driven by the socket connecting. If the
 *     socket only lived in ChatPage, you'd appear offline on every other page.
 *   - Notifications + unread counts must update no matter which page you're on.
 *   - Delivery receipts (✓✓) must be sent whenever a message arrives, even if
 *     you're not currently on the chat page.
 *
 * It owns the GLOBAL concerns (connection, presence, notifications, delivery)
 * and lets page-level components (ChatPage) register listeners for the rest
 * (incoming messages into the open thread, status ticks, typing, reactions,
 * deletes, edits).
 */

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
    const { user } = useAuth();
    const { handleNotification, refreshUnreadCounts } = useNotification();
    const navigate = useNavigate();

    // userId -> { userId, online, lastSeen }. App-wide presence.
    const [presence, setPresence] = useState({});

    // The most recent notification, for the toast banner (any page can read it).
    const [activeToast, setActiveToast] = useState(null);

    // Connect exactly once per login.
    const connectedRef = useRef(false);

    // Page-level listeners. ChatPage registers handlers here; the socket
    // callbacks fan out to whatever is currently registered.
    const listenersRef = useRef({
        message: new Set(),
        status: new Set(),
        typing: new Set(),
        reaction: new Set(),
        deleted: new Set(),
        edited: new Set(),
    });

    // Which conversation is currently open/being viewed. Lets the provider
    // suppress the toast AND the unread-badge bump for that conversation.
    const openConversationRef = useRef(null);

    const setOpenConversation = useCallback((conversationId) => {
        openConversationRef.current = conversationId;
    }, []);

    // Register a listener for an event; returns an unsubscribe function.
    const addListener = useCallback((event, handler) => {
        const set = listenersRef.current[event];
        if (!set) return () => {};
        set.add(handler);
        return () => set.delete(handler);
    }, []);

    const emit = (event, payload) => {
        const set = listenersRef.current[event];
        if (set) set.forEach((fn) => fn(payload));
    };

    useEffect(() => {
        if (!user) {
            // Logged out — tear down.
            if (connectedRef.current) {
                disconnectWebSocket();
                connectedRef.current = false;
                setPresence({});
            }
            return;
        }

        if (connectedRef.current) return;
        connectedRef.current = true;

        connectWebSocket(
            // onMessage — mark delivered globally (any page), then fan out to
            // ChatPage's listener (which handles read + appending to the thread).
            (message) => {
                const mine = message.senderId === user.userId;
                const open = message.conversationId === openConversationRef.current;
                // If it's not mine and I'm not actively viewing that chat, at least
                // acknowledge delivery — no matter which page I'm on. (When I AM
                // viewing it, ChatPage sends READ, which covers delivery too.)
                if (!mine && !open) {
                    sendDelivered(message.conversationId);
                }
                emit("message", message);
            },
            // onStatus
            (update) => emit("status", update),
            // onPresence — GLOBAL: update app-wide presence
            (p) => setPresence((prev) => ({ ...prev, [p.userId]: p })),
            // onTyping
            (event) => emit("typing", event),
            // onReaction
            (update) => emit("reaction", update),
            // onNotification — GLOBAL badge + toast, EXCEPT for the open chat.
            (notification) => {
                const isReaction = notification.type === "REACTION";

                // For MESSAGE notifications, suppress entirely if I'm already
                // viewing that conversation (it's being read). Reactions always
                // toast, since you want to know even while in the chat.
                if (!isReaction && notification.conversationId === openConversationRef.current) {
                    return;
                }

                setActiveToast(notification);
                if (document.hidden && "Notification" in window && Notification.permission === "granted") {
                    try {
                        new Notification(notification.senderName, {
                            body: notification.preview,
                            icon: "/favicon.svg",
                        });
                    } catch {
                        /* in-app toast still shows */
                    }
                }

                // Only real messages affect the unread badge; reactions don't.
                if (!isReaction) {
                    handleNotification(notification);
                }
            },
            // onMessageDeleted
            (event) => emit("deleted", event),
            // onMessageEdited
            (event) => emit("edited", event),
        );
        // Pull authoritative unread counts now that we're connected.
        refreshUnreadCounts();

        // We intentionally do NOT disconnect on cleanup here — the socket must
        // survive page navigation. It's torn down only on logout (above).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    // Ask for browser-notification permission on first user click (browsers
    // block auto-prompts). Once.
    useEffect(() => {
        if (!("Notification" in window)) return;
        if (Notification.permission !== "default") return;
        const askOnce = () => {
            try {
                const r = Notification.requestPermission();
                if (r && typeof r.catch === "function") r.catch(() => {});
            } catch { /* ignore */ }
            window.removeEventListener("click", askOnce);
        };
        window.addEventListener("click", askOnce);
        return () => window.removeEventListener("click", askOnce);
    }, []);

    const value = {
        presence,
        setPresence,
        activeToast,
        setActiveToast,
        addListener,
        setOpenConversation,
    };

    // Clicking the toast: remember which conversation to open, then go to /chat.
    const openFromToast = (conversationId) => {
        if (conversationId?.startsWith("dm:")) {
            const parts = conversationId.split(":");
            const me = user?.userId;
            const otherId = Number(parts[1]) === me ? Number(parts[2]) : Number(parts[1]);
            sessionStorage.setItem("pulse_selected", JSON.stringify({ type: "dm", userId: otherId }));
        } else if (conversationId?.startsWith("group:")) {
            const groupId = Number(conversationId.split(":")[1]);
            sessionStorage.setItem("pulse_selected", JSON.stringify({ type: "group", id: groupId }));
        }
        setActiveToast(null);
        navigate("/chat");
    };

    return (
        <SocketContext.Provider value={value}>
            {children}
            {/* App-wide toast: shows on every page, not just the chat page. */}
            <NotificationToast
                notification={activeToast}
                onClose={() => setActiveToast(null)}
                onClick={openFromToast}
            />
        </SocketContext.Provider>
    );
}

export function useSocket() {
    const ctx = useContext(SocketContext);
    if (!ctx) {
        throw new Error("useSocket must be used inside <SocketProvider>");
    }
    return ctx;
}
