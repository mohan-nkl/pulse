import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { getToken } from "../api/client";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

let stompClient = null;

export function connectWebSocket(onMessage) {
    const token = getToken();

    stompClient = new Client({
        webSocketFactory: () => new SockJS(`${BASE_URL}/ws?token=${token}`),
        onConnect: () => {
            stompClient.subscribe("/user/queue/messages", (frame) => {
                const message = JSON.parse(frame.body);
                onMessage(message);
            });
        },
        reconnectDelay: 5000,
    });

    stompClient.activate();
}

export function sendMessage(receiverId, content) {
    if (!stompClient?.connected) return;
    stompClient.publish({
        destination: "/app/chat.send",
        body: JSON.stringify({ receiverId, content }),
    });
}

export function disconnectWebSocket() {
    stompClient?.deactivate();
    stompClient = null;
}
