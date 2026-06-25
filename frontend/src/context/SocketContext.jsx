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

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
    const { user } = useAuth();
    const { handleNotification, refreshUnreadCounts } = useNotification();
    const navigate = useNavigate();

    const [presence, setPresence] = useState({});

    const [activeToast, setActiveToast] = useState(null);

    const connectedRef = useRef(false);

    const listenersRef = useRef({
        message: new Set(),
        status: new Set(),
        typing: new Set(),
        reaction: new Set(),
        deleted: new Set(),
        edited: new Set(),
        statusView: new Set(),
        groupAdded: new Set(),
    });

    const openConversationRef = useRef(null);

    const setOpenConversation = useCallback((conversationId) => {
        openConversationRef.current = conversationId;
    }, []);

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

            (message) => {
                const mine = message.senderId === user.userId;
                const open = message.conversationId === openConversationRef.current;

                if (!mine && !open) {
                    sendDelivered(message.conversationId);
                }
                emit("message", message);
            },

            (update) => emit("status", update),

            (p) => setPresence((prev) => ({ ...prev, [p.userId]: p })),

            (event) => emit("typing", event),

            (update) => emit("reaction", update),

            (notification) => {
                const isReaction = notification.type === "REACTION";

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

                    }
                }

                if (!isReaction) {
                    handleNotification(notification);
                }
            },

            (event) => emit("deleted", event),

            (event) => emit("edited", event),

            (event) => emit("statusView", event),

            (group) => emit("groupAdded", group),
        );

        refreshUnreadCounts();

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    useEffect(() => {
        if (!("Notification" in window)) return;
        if (Notification.permission !== "default") return;
        const askOnce = () => {
            try {
                const r = Notification.requestPermission();
                if (r && typeof r.catch === "function") r.catch(() => {});
            } catch {  }
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
            {}
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
