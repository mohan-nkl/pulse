import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { getToken } from "../api/client";

// Same backend origin the REST client uses.
const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

// A single STOMP client for the whole app session.
let stompClient = null;

/**
 * Opens the WebSocket connection and subscribes to this user's private message
 * queue. Every incoming message is handed to onMessage(message).
 *
 * The JWT goes in the URL as a query param because browsers can't set headers
 * on the SockJS handshake — the backend's WebSocketAuthInterceptor reads it there.
 */
export function connectWebSocket(onMessage) {
    const token = getToken();

    stompClient = new Client({
        // SockJS needs an http(s) URL (not ws://); Spring's withSockJS() expects this.
        webSocketFactory: () => new SockJS(`${BASE_URL}/ws?token=${token}`),
        reconnectDelay: 5000, // auto-reconnect 5s after a dropped connection

        onConnect: () => {
            // Spring delivers convertAndSendToUser(..., "/queue/messages", ...) here.
            stompClient.subscribe("/user/queue/messages", (frame) => {
                const message = JSON.parse(frame.body);
                onMessage(message);
            });
        },
    });

    stompClient.activate();
}

/**
 * Sends a one-to-one message to the given receiver.
 * Publishes to "/app/chat.send", which maps to ChatController.sendMessage.
 */
export function sendMessage(receiverId, content) {
    if (!stompClient || !stompClient.connected) {
        return;
    }

    stompClient.publish({
        destination: "/app/chat.send",
        body: JSON.stringify({ receiverId, content }),
    });
}

/**
 * Cleanly closes the connection (call on logout or when leaving the chat).
 */
export function disconnectWebSocket() {
    if (stompClient) {
        stompClient.deactivate();
        stompClient = null;
    }
}