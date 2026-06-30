import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { getToken } from "../api/client";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

let stompClient = null;

export function connectWebSocket(onMessage, onStatus, onPresence, onTyping, onReaction, onNotification, onMessageDeleted, onMessageEdited, onStatusView, onGroupAdded, onCall) {

    if (stompClient) {
        stompClient.deactivate();
        stompClient = null;
    }

    stompClient = new Client({

        webSocketFactory: () => new SockJS(`${BASE_URL}/ws?token=${getToken()}`),
        reconnectDelay: 5000,

        heartbeatIncoming: 10000,
        heartbeatOutgoing: 10000,

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

            stompClient.subscribe("/user/topic/presence", (frame) => {
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

            stompClient.subscribe("/user/queue/status-views", (frame) => {
                if (onStatusView) {
                    onStatusView(JSON.parse(frame.body));
                }
            });

            stompClient.subscribe("/user/queue/group-added", (frame) => {
                if (onGroupAdded) {
                    onGroupAdded(JSON.parse(frame.body));
                }
            });

            stompClient.subscribe("/user/queue/call", (frame) => {
                if (onCall) {
                    onCall(JSON.parse(frame.body));
                }
            });

            sendDelivered(null);
        },
    });

    stompClient.activate();
}

export function sendMessage(receiverId, content, messageType = "TEXT", mediaUrl = null, replyToId = null) {
    if (!stompClient || !stompClient.connected) return;

    stompClient.publish({
        destination: "/app/chat.send",
        body: JSON.stringify({ receiverId, content, messageType, mediaUrl, replyToId }),
    });
}

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

export function sendCallSignal(signal) {
    if (!stompClient || !stompClient.connected) {
        return;
    }

    stompClient.publish({
        destination: "/app/call.signal",
        body: JSON.stringify(signal),
    });
}

export function disconnectWebSocket() {
    if (stompClient) {
        stompClient.deactivate();
        stompClient = null;
    }
}