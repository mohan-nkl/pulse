import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { getToken } from "../api/client";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

// A single STOMP client for the whole app session.
let stompClient = null;


export function connectWebSocket(onMessage) {
    const token = getToken();

    stompClient = new Client({
        webSocketFactory: () => new SockJS(`${BASE_URL}/ws?token=${token}`),
        reconnectDelay: 5000, // auto-reconnect 5s after a dropped connection

        onConnect: () => {
            stompClient.subscribe("/user/queue/messages", (frame) => {
                const message = JSON.parse(frame.body);
                onMessage(message);
            });
        },
    });

    stompClient.activate();
}

export function sendMessage(receiverId, content) {
    if (!stompClient || !stompClient.connected) {
        return;
    }

    stompClient.publish({
        destination: "/app/chat.send",
        body: JSON.stringify({ receiverId, content }),
    });
}

export function sendGroupMessage(groupId, content) {
    if (!stompClient || !stompClient.connected) {
        return;
    }

    stompClient.publish({
        destination: "/app/group.send",
        body: JSON.stringify({ groupId, content }),
    });
}

export function disconnectWebSocket() {
    if (stompClient) {
        stompClient.deactivate();
        stompClient = null;
    }
}