import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import client from "../api/client";
import {
    connectWebSocket,
    sendMessage,
    sendGroupMessage,
    disconnectWebSocket,
} from "../services/WebSocket";
import { listGroups, getGroupHistory, getGroupMembers } from "../api/groupApi";
import NewGroupModal from "../components/NewGroupModal";
import GroupMembersPanel from "../components/GroupMembersPanel";

// Client-side mirrors of the backend ConversationUtil — must produce the SAME
// ids, so we can tell which open conversation an incoming live message belongs to.
function dmConversationId(a, b) {
    const smaller = Math.min(a, b);
    const larger = Math.max(a, b);
    return `dm:${smaller}:${larger}`;
}
function groupConversationId(groupId) {
    return `group:${groupId}`;
}

export default function ChatPage() {
    const { user } = useAuth();
    const currentUserId = user?.userId;

    const [contacts, setContacts] = useState([]);
    const [groups, setGroups] = useState([]);

    // The open conversation: either { type: "dm", userId, name }
    // or a group object { type: "group", id, name, myRole, ... }. null = nothing open.
    const [selected, setSelected] = useState(null);

    const [messages, setMessages] = useState([]);
    const [draft, setDraft] = useState("");

    // userId -> name for the open group, so we can label who sent each message.
    const [memberNames, setMemberNames] = useState({});

    const [showNewGroup, setShowNewGroup] = useState(false);
    const [showMembers, setShowMembers] = useState(false);

    const openConversationIdRef = useRef(null);
    const bottomRef = useRef(null);

    useEffect(() => {
        loadContacts();
        loadGroups();

        connectWebSocket((message) => {
            // Append only if the message belongs to the conversation currently open.
            if (message.conversationId === openConversationIdRef.current) {
                setMessages((previous) => [...previous, message]);
            }
        });

        return () => disconnectWebSocket();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const loadContacts = async () => {
        try {
            const response = await client.get("/api/v1/contacts");
            // The contacts API returns each row as { contactId, name, alias, ... }.
            // The chat UI identifies the other person by userId, so we map
            // contactId -> userId (and show the alias as the name when one is set).
            const mapped = (response.data.data || []).map((c) => ({
                userId: c.contactId,
                name: c.alias || c.name,
                avatarUrl: c.avatarUrl,
            }));
            setContacts(mapped);
        } catch {
            // Leave empty on failure.
        }
    };

    const loadGroups = async () => {
        try {
            setGroups(await listGroups());
        } catch {
            // Leave empty on failure.
        }
    };

    const openDirect = async (contact) => {
        setSelected({ type: "dm", userId: contact.userId, name: contact.name });
        openConversationIdRef.current = dmConversationId(currentUserId, contact.userId);
        setShowMembers(false);
        setMemberNames({});

        try {
            const response = await client.get(`/api/conversations/${contact.userId}`);
            setMessages(response.data.data);
        } catch {
            setMessages([]);
        }
    };

    const openGroup = async (group) => {
        setSelected({ type: "group", ...group });
        openConversationIdRef.current = groupConversationId(group.id);
        setShowMembers(false);

        try {
            const [history, members] = await Promise.all([
                getGroupHistory(group.id),
                getGroupMembers(group.id),
            ]);
            setMessages(history);

            const names = {};
            members.forEach((member) => {
                names[member.userId] = member.name;
            });
            setMemberNames(names);
        } catch {
            setMessages([]);
            setMemberNames({});
        }
    };

    const handleSend = () => {
        const text = draft.trim();
        if (!text || !selected) {
            return;
        }

        if (selected.type === "dm") {
            sendMessage(selected.userId, text);
        } else {
            sendGroupMessage(selected.id, text);
        }
        setDraft("");
    };

    const handleGroupCreated = (group) => {
        setGroups((previous) => [group, ...previous]);
        setShowNewGroup(false);
        openGroup(group);
    };

    const handleLeftGroup = () => {
        setGroups((previous) => previous.filter((g) => g.id !== selected.id));
        setSelected(null);
        setMessages([]);
        openConversationIdRef.current = null;
        setShowMembers(false);
    };

    return (
        <div style={styles.page}>
            <aside style={styles.sidebar}>
                <div style={styles.sidebarHeader}>
                    <h2 style={styles.sidebarTitle}>Pulse</h2>
                    <button style={styles.newGroupBtn} onClick={() => setShowNewGroup(true)}>
                        New group
                    </button>
                </div>

                <p style={styles.sectionLabel}>Groups</p>
                {groups.length === 0 && <p style={styles.empty}>No groups yet.</p>}
                {groups.map((group) => (
                    <button
                        key={`g-${group.id}`}
                        style={{
                            ...styles.item,
                            ...(selected?.type === "group" && selected.id === group.id
                                ? styles.itemActive
                                : {}),
                        }}
                        onClick={() => openGroup(group)}
                    >
                        # {group.name}
                    </button>
                ))}

                <p style={styles.sectionLabel}>Chats</p>
                {contacts.length === 0 && <p style={styles.empty}>No contacts yet.</p>}
                {contacts.map((contact) => (
                    <button
                        key={`c-${contact.userId}`}
                        style={{
                            ...styles.item,
                            ...(selected?.type === "dm" && selected.userId === contact.userId
                                ? styles.itemActive
                                : {}),
                        }}
                        onClick={() => openDirect(contact)}
                    >
                        {contact.name || "Unknown"}
                    </button>
                ))}
            </aside>

            <main style={styles.chat}>
                {!selected ? (
                    <div style={styles.placeholder}>Select a chat or group to start messaging.</div>
                ) : (
                    <>
                        <header style={styles.chatHeader}>
                            <span>{selected.name}</span>
                            {selected.type === "group" && (
                                <button style={styles.infoBtn} onClick={() => setShowMembers((v) => !v)}>
                                    Members
                                </button>
                            )}
                        </header>

                        <div style={styles.messages}>
                            {messages.map((message) => {
                                const mine = message.senderId === currentUserId;
                                const showSender = selected.type === "group" && !mine;
                                return (
                                    <div
                                        key={message.id}
                                        style={{
                                            ...styles.bubble,
                                            ...(mine ? styles.bubbleMine : styles.bubbleTheirs),
                                        }}
                                    >
                                        {showSender && (
                                            <div style={styles.sender}>
                                                {memberNames[message.senderId] || "Unknown"}
                                            </div>
                                        )}
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

            {showMembers && selected?.type === "group" && (
                <GroupMembersPanel
                    group={selected}
                    contacts={contacts}
                    currentUserId={currentUserId}
                    onClose={() => setShowMembers(false)}
                    onLeft={handleLeftGroup}
                />
            )}

            {showNewGroup && (
                <NewGroupModal
                    contacts={contacts}
                    onClose={() => setShowNewGroup(false)}
                    onCreated={handleGroupCreated}
                />
            )}
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
    sidebarHeader: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        margin: "4px 8px 12px",
    },
    sidebarTitle: { fontSize: "18px", margin: 0, color: "#e9edef" },
    newGroupBtn: {
        fontSize: "12px",
        padding: "6px 10px",
        border: "none",
        borderRadius: "6px",
        background: "#00a884",
        color: "#fff",
        cursor: "pointer",
    },
    sectionLabel: {
        fontSize: "12px",
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        color: "#8696a0",
        margin: "14px 8px 6px",
    },
    empty: { fontSize: "14px", color: "#8696a0", padding: "0 8px" },
    item: {
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
    itemActive: { background: "#2a3942" },
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
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
    },
    infoBtn: {
        fontSize: "13px",
        padding: "6px 12px",
        border: "1px solid #2a3942",
        borderRadius: "6px",
        background: "transparent",
        color: "#e9edef",
        cursor: "pointer",
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
    sender: { fontSize: "12px", color: "#53bdeb", marginBottom: "2px", fontWeight: 600 },
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
};