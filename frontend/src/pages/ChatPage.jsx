import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import client from "../api/client";
import {
    connectWebSocket,
    sendMessage,
    disconnectWebSocket,
} from "../services/websocket";

// Mirror of the backend ConversationUtil — must produce the SAME id format,
// so we can tell which open conversation an incoming live message belongs to.
function dmConversationId(a, b) {
    const smaller = Math.min(a, b);
    const larger = Math.max(a, b);
    return `dm:${smaller}:${larger}`;
}

export default function ChatPage() {
    const { user } = useAuth();
    const currentUserId = user?.userId;

    const [contacts, setContacts] = useState([]);
    const [selectedContact, setSelectedContact] = useState(null);
    const [messages, setMessages] = useState([]);
    const [draft, setDraft] = useState("");

    // The conversation currently on screen. Kept in a ref so the WebSocket handler
    // (registered once on mount) always reads the latest value, not a stale snapshot.
    const openConversationIdRef = useRef(null);

    // Auto-scroll target at the bottom of the message list.
    const bottomRef = useRef(null);

    // Load contacts once and open the live connection on mount.
    useEffect(() => {
        loadContacts();

        connectWebSocket((message) => {
            // Append only if the message belongs to the conversation currently open.
            if (message.conversationId === openConversationIdRef.current) {
                setMessages((previous) => [...previous, message]);
            }
        });

        return () => disconnectWebSocket(); // close the socket when leaving the page
    }, []);

    // Keep the view scrolled to the newest message.
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const loadContacts = async () => {
        try {
            const response = await client.get("/api/contacts");
            setContacts(response.data.data);
        } catch {
            // Leave the list empty on failure; a fuller app would surface an error.
        }
    };

    // Open a contact's conversation and load its history.
    const openConversation = async (contact) => {
        setSelectedContact(contact);
        openConversationIdRef.current = dmConversationId(currentUserId, contact.userId);

        try {
            const response = await client.get(`/api/conversations/${contact.userId}`);
            setMessages(response.data.data);
        } catch {
            setMessages([]);
        }
    };

    const handleSend = () => {
        const text = draft.trim();
        if (!text || !selectedContact) {
            return;
        }
        // Just publish — the backend echoes it back to us over the subscription,
        // so we don't append it manually here (that would double it).
        sendMessage(selectedContact.userId, text);
        setDraft("");
    };

    return (
        <div style={styles.page}>
            <aside style={styles.sidebar}>
                <h2 style={styles.sidebarTitle}>Chats</h2>
                {contacts.length === 0 && <p style={styles.empty}>No contacts yet.</p>}
                {contacts.map((contact) => (
                    <button
                        key={contact.userId}
                        style={{
                            ...styles.contact,
                            ...(selectedContact?.userId === contact.userId ? styles.contactActive : {}),
                        }}
                        onClick={() => openConversation(contact)}
                    >
                        {contact.name || "Unknown"}
                    </button>
                ))}
            </aside>

            <main style={styles.chat}>
                {!selectedContact ? (
                    <div style={styles.placeholder}>Select a contact to start chatting.</div>
                ) : (
                    <>
                        <header style={styles.chatHeader}>{selectedContact.name}</header>

                        <div style={styles.messages}>
                            {messages.map((message) => {
                                const mine = message.senderId === currentUserId;
                                return (
                                    <div
                                        key={message.id}
                                        style={{
                                            ...styles.bubble,
                                            ...(mine ? styles.bubbleMine : styles.bubbleTheirs),
                                        }}
                                    >
                                        {message.content}
                                    </div>
                                );
                            })}
                            <div ref={bottomRef} />
                        </div>

                        <div style={styles.composer}>
                            <input
                                style={styles.input}
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                                placeholder="Type a message"
                            />
                            <button style={styles.sendButton} onClick={handleSend}>
                                Send
                            </button>
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}

const styles = {
    page: { display: "flex", height: "100vh", background: "#0b141a", color: "#e9edef" },
    sidebar: {
        width: "280px",
        borderRight: "1px solid #222d34",
        overflowY: "auto",
        padding: "12px",
        background: "#111b21",
    },
    sidebarTitle: { fontSize: "18px", margin: "4px 8px 12px", color: "#e9edef" },
    empty: { fontSize: "14px", color: "#8696a0", padding: "0 8px" },
    contact: {
        display: "block",
        width: "100%",
        textAlign: "left",
        padding: "10px 8px",
        border: "none",
        background: "transparent",
        cursor: "pointer",
        fontSize: "15px",
        borderRadius: "6px",
        color: "#e9edef",
    },
    contactActive: { background: "#2a3942" },
    chat: { flex: 1, display: "flex", flexDirection: "column", background: "#0b141a" },
    placeholder: {
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#8696a0",
    },
    chatHeader: {
        padding: "14px 16px",
        borderBottom: "1px solid #222d34",
        fontWeight: 600,
        color: "#e9edef",
    },
    messages: {
        flex: 1,
        overflowY: "auto",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
    },
    bubble: { maxWidth: "60%", padding: "8px 12px", borderRadius: "10px", fontSize: "14px" },
    bubbleMine: { alignSelf: "flex-end", background: "#005c4b", color: "#e9edef" },
    bubbleTheirs: { alignSelf: "flex-start", background: "#202c33", color: "#e9edef" },
    composer: {
        display: "flex",
        gap: "8px",
        padding: "12px",
        borderTop: "1px solid #222d34",
        background: "#111b21",
    },
    input: {
        flex: 1,
        padding: "10px",
        fontSize: "14px",
        border: "1px solid #2a3942",
        borderRadius: "6px",
        background: "#2a3942",
        color: "#e9edef",
        outline: "none",
    },
    sendButton: {
        padding: "10px 18px",
        border: "none",
        borderRadius: "6px",
        cursor: "pointer",
        background: "#00a884",
        color: "#fff",
    },
};;