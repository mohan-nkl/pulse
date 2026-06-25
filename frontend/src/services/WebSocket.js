import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { getToken } from "../api/client";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

let stompClient = null;

export function connectWebSocket(onMessage, onStatus, onPresence, onTyping, onReaction, onNotification, onMessageDeleted, onMessageEdited) {
    // Idempotent: if a client already exists (StrictMode double-mount or a
    // re-entry into the chat), tear it down first so we never run two live
    // sockets delivering every message/notification twice.
    if (stompClient) {
        stompClient.deactivate();
        stompClient = null;
    }

    stompClient = new Client({
        // Re-read the token FRESH on every (re)connect so reconnections always
        // use a current token rather than one captured at first connect.
        webSocketFactory: () => new SockJS(`${BASE_URL}/ws?token=${getToken()}`),
        reconnectDelay: 5000,

        // Heartbeats keep the connection alive. Without them, proxies and
        // browsers silently drop idle WebSockets after ~60s — which looks like
        // "everything stops working after a while". 10s each way is safe.
        heartbeatIncoming: 10000,
        heartbeatOutgoing: 10000,

        // Surface problems instead of dying silently. The client auto-reconnects
        // (reconnectDelay), and onConnect re-subscribes every time, so recovery
        // is automatic — these handlers just make failures visible.
        onStompError: (frame) => {
            console.error("STOMP error:", frame?.headers?.message, frame?.body);
        },
        onWebSocketClose: (evt) => {
            console.warn("WebSocket closed; will attempt to reconnect.", evt?.reason || "");
        },
        onWebSocketError: (evt) => {
            console.error("WebSocket error.", evt);
        },

        onConnect: () => {
            stompClient.subscribe("/user/queue/messages", (frame) => {
                const message = JSON.parse(frame.body);
                onMessage(message);
            });

            stompClient.subscribe("/user/queue/status", (frame) => {
                if (onStatus) {
                    onStatus(JSON.parse(frame.body));
                }
            });

            stompClient.subscribe("/topic/presence", (frame) => {
                if (onPresence) {
                    onPresence(JSON.parse(frame.body));
                }
            });

            stompClient.subscribe("/user/queue/typing", (frame) => {
                if (onTyping) {
                    onTyping(JSON.parse(frame.body)); 
                }
            });

            stompClient.subscribe("/user/queue/reactions", (frame) => {
                if (onReaction) {
                    onReaction(JSON.parse(frame.body));
                }
            });

            stompClient.subscribe("/user/queue/notifications", (frame) => {
                if (onNotification) {
                    onNotification(JSON.parse(frame.body));
                }
            });

            stompClient.subscribe("/user/queue/message-deleted", (frame) => {
                if (onMessageDeleted) {
                    onMessageDeleted(JSON.parse(frame.body));
                }
            });

            stompClient.subscribe("/user/queue/message-edited", (frame) => {
                if (onMessageEdited) {
                    onMessageEdited(JSON.parse(frame.body));
                }
            });

            sendDelivered(null);
        },
    });

    stompClient.activate();
}

/**
 * Send a direct message to another user.
 *
 * Text message:
 *   sendMessage(5, "hello")
 *
 * Media message (after uploading the file first):
 *   sendMessage(5, "", "IMAGE", "http://localhost:8080/media/abc.jpg")
 *
 * Reply (text or media): pass the id of the message being replied to:
 *   sendMessage(5, "haha yes", "TEXT", null, 42)
 */
export function sendMessage(receiverId, content, messageType = "TEXT", mediaUrl = null, replyToId = null) {
    if (!stompClient || !stompClient.connected) return;

    stompClient.publish({
        destination: "/app/chat.send",
        body: JSON.stringify({ receiverId, content, messageType, mediaUrl, replyToId }),
    });
}

/**
 * Send a message to a group.
 * Same as sendMessage() but with groupId instead of receiverId.
 */
export function sendGroupMessage(groupId, content, messageType = "TEXT", mediaUrl = null, replyToId = null) {
    if (!stompClient || !stompClient.connected) return;

    stompClient.publish({
        destination: "/app/group.send",
        body: JSON.stringify({ groupId, content, messageType, mediaUrl, replyToId }),
    });
}

export function sendDelivered(conversationId) {
    if (!stompClient || !stompClient.connected) return;

    stompClient.publish({
        destination: "/app/chat.delivered",
        body: JSON.stringify({ conversationId }),
    });
}

export function sendRead(conversationId) {
    if (!stompClient || !stompClient.connected) return;

    stompClient.publish({
        destination: "/app/chat.read",
        body: JSON.stringify({ conversationId }),
    });
}

export function sendTyping(conversationId, typing) {
    if (!stompClient || !stompClient.connected) {
        return;
    }

    stompClient.publish({
        destination: "/app/chat.typing",
        body: JSON.stringify({ conversationId, typing }),
    });
}

export function disconnectWebSocket() {
    if (stompClient) {
        stompClient.deactivate();
        stompClient = null;
    }
}