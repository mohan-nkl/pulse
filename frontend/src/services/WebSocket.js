import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { getToken } from "../api/client";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

let stompClient = null;

export function connectWebSocket(onMessage, onStatus, onPresence, onTyping, onReaction) {
    const token = getToken();

    stompClient = new Client({
        webSocketFactory: () => new SockJS(`${BASE_URL}/ws?token=${token}`),
        reconnectDelay: 5000,

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

export function disconnectWebSocket() {
    if (stompClient) {
        stompClient.deactivate();
        stompClient = null;
    }
}