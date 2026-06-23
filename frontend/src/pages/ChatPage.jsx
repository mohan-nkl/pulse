import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import HomeButton from "../components/HomeButton";
import client from "../api/client";
import {
    connectWebSocket,
    sendMessage,
    sendGroupMessage,
    sendDelivered,
    sendRead,
    sendTyping,
    disconnectWebSocket,
} from "../services/WebSocket.js";
import { listGroups, getGroupHistory, getGroupMembers } from "../api/groupApi";
import NewGroupModal from "../components/NewGroupModal";
import GroupMembersPanel from "../components/GroupMembersPanel";

// How often (at most) we tell the server "I'm typing" while keys are flowing,
// and how long after the last keystroke we send "I stopped".
const TYPING_THROTTLE_MS = 2000;
const TYPING_IDLE_MS = 3000;
// How long a RECEIVED "typing" lasts before we clear it ourselves, in case the
// sender's "stopped" event never arrives (dropped socket, closed tab).
const TYPING_EXPIRE_MS = 4000;

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

// "2026-06-23T09:49:00Z" -> "9:49 AM"
function formatTime(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// A friendly "last seen" string, WhatsApp-style.
function formatLastSeen(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const now = new Date();
    const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === now.toDateString()) return `today at ${time}`;
    if (d.toDateString() === yesterday.toDateString()) return `yesterday at ${time}`;
    return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} at ${time}`;
}

// "online" / "last seen ..." / "" for the DM chat header.
function presenceLabel(p) {
    if (!p) return "";
    if (p.online) return "online";
    if (p.lastSeen) return `last seen ${formatLastSeen(p.lastSeen)}`;
    return "";
}

// "3 online" if anyone (other than me) is online, else "5 members".
function groupHeaderLabel(memberNames, presence, currentUserId) {
    const ids = Object.keys(memberNames).map(Number);
    if (ids.length === 0) return "";
    const online = ids.filter((id) => id !== currentUserId && presence[id]?.online).length;
    return online > 0 ? `${online} online` : `${ids.length} members`;
}

// The header's second line. Typing wins over presence: if someone is typing in
// THIS conversation, show that; otherwise fall back to online / last seen.
function headerStatusLine(selected, typingUserIds, memberNames, presence, currentUserId) {
    if (selected.type === "dm") {
        // For a DM there's only one other person; any typing entry means them.
        if (typingUserIds.length > 0) return "typing...";
        return presenceLabel(presence[selected.userId]);
    }
    // Group: name the typers (other than me), up to two, then "and N others".
    const others = typingUserIds.filter((id) => id !== currentUserId);
    if (others.length > 0) {
        const names = others.map((id) => memberNames[id] || "Someone");
        if (names.length === 1) return `${names[0]} is typing...`;
        if (names.length === 2) return `${names[0]} and ${names[1]} are typing...`;
        return `${names[0]}, ${names[1]} and ${names.length - 2} others are typing...`;
    }
    return groupHeaderLabel(memberNames, presence, currentUserId);
}

// The tick(s) shown on MY messages: ✓ sent, ✓✓ delivered, ✓✓ blue read.
function Ticks({ message }) {
    const status = message.status || "SENT";
    const isRead = status === "READ";
    const isDelivered = status === "DELIVERED" || isRead;
    const symbol = isDelivered ? "✓✓" : "✓";
    const color = isRead ? "#4fc3f7" : "#a8c5bd";
    return <span style={{ color, fontWeight: 700 }}>{symbol}</span>;
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

    // userId -> { userId, online, lastSeen } presence for contacts / open chat.
    const [presence, setPresence] = useState({});

    // conversationId -> { [userId]: timeoutId } for people currently typing in
    // that chat. The timeout auto-clears the entry if no "stopped" arrives.
    const [typing, setTyping] = useState({});

    // Bumped once a minute purely to re-render relative "last seen ..." labels.
    const [, setNowTick] = useState(0);

    const [showNewGroup, setShowNewGroup] = useState(false);
    const [showMembers, setShowMembers] = useState(false);

    const openConversationIdRef = useRef(null);
    const bottomRef = useRef(null);
    // Always-fresh copy of my id, so the WebSocket callback (created once at
    // mount) never reads a stale/undefined value.
    const currentUserIdRef = useRef(null);

    // Outbound-typing bookkeeping (refs, not state — they must never re-render).
    const lastTypingSentRef = useRef(0);       // when we last sent "typing: true"
    const typingIdleTimerRef = useRef(null);   // fires "typing: false" after a pause
    // Holds the per-user auto-expire timers for RECEIVED typing, so we can clear
    // them on unmount and avoid leaks.
    const typingExpiryTimersRef = useRef({});

    // Keep the id ref in sync with the logged-in user.
    useEffect(() => {
        currentUserIdRef.current = currentUserId;
    }, [currentUserId]);

    // Re-render every minute so "last seen ..." stays current (e.g. rolls over
    // to "yesterday") even if no new presence update arrives.
    useEffect(() => {
        const timer = setInterval(() => setNowTick((n) => n + 1), 60000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        loadContacts();
        loadGroups();

        connectWebSocket(
            (message) => {
                const mine = message.senderId === currentUserIdRef.current;

                // My OWN echoed message: just show it, never acknowledge it.
                if (mine) {
                    if (message.conversationId === openConversationIdRef.current) {
                        setMessages((previous) => [...previous, message]);
                    }
                    return;
                }

                // Someone else sent this. A new message means they're no longer
                // "typing" — clear any indicator we were showing for them.
                clearTyping(message.conversationId, message.senderId);

                if (message.conversationId === openConversationIdRef.current) {
                    setMessages((previous) => [...previous, message]);
                    sendRead(message.conversationId);     // I'm looking at it
                } else {
                    sendDelivered(message.conversationId); // arrived, chat not open
                }
            },
            (update) => {
                // A tick advanced on one of MY messages — update just that bubble.
                setMessages((previous) =>
                    previous.map((m) =>
                        m.id === update.messageId
                            ? {
                                ...m,
                                status: update.status,
                                deliveredCount: update.deliveredCount,
                                readCount: update.readCount,
                                totalRecipients: update.totalRecipients,
                            }
                            : m
                    )
                );
            },
            (p) => {
                // Someone went online/offline — update just that user's presence.
                setPresence((previous) => ({ ...previous, [p.userId]: p }));
            },
            (event) => {
                // Someone started/stopped typing in a chat I'm part of.
                if (event.typing) {
                    markTyping(event.conversationId, event.userId);
                } else {
                    clearTyping(event.conversationId, event.userId);
                }
            }
        );

        return () => {
            disconnectWebSocket();
            // Clear any pending typing timers so they don't fire after unmount.
            if (typingIdleTimerRef.current) clearTimeout(typingIdleTimerRef.current);
            Object.values(typingExpiryTimersRef.current).forEach(clearTimeout);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // ---- received typing: record + auto-expire ----

    // Record that `userId` is typing in `conversationId`, and (re)arm a timer
    // that clears them after TYPING_EXPIRE_MS if no fresh event arrives.
    const markTyping = (conversationId, userId) => {
        const key = `${conversationId}:${userId}`;

        // Reset any existing expiry timer for this person.
        if (typingExpiryTimersRef.current[key]) {
            clearTimeout(typingExpiryTimersRef.current[key]);
        }
        typingExpiryTimersRef.current[key] = setTimeout(() => {
            clearTyping(conversationId, userId);
        }, TYPING_EXPIRE_MS);

        setTyping((previous) => {
            const forConvo = previous[conversationId] || {};
            if (forConvo[userId]) return previous; // already showing; nothing to change
            return { ...previous, [conversationId]: { ...forConvo, [userId]: true } };
        });
    };

    // Remove `userId` from the typing set for `conversationId` (and kill its timer).
    const clearTyping = (conversationId, userId) => {
        const key = `${conversationId}:${userId}`;
        if (typingExpiryTimersRef.current[key]) {
            clearTimeout(typingExpiryTimersRef.current[key]);
            delete typingExpiryTimersRef.current[key];
        }
        setTyping((previous) => {
            const forConvo = previous[conversationId];
            if (!forConvo || !forConvo[userId]) return previous;
            const next = { ...forConvo };
            delete next[userId];
            return { ...previous, [conversationId]: next };
        });
    };

    // ---- outbound typing: throttle + idle-stop ----

    // Called on every keystroke in the composer.
    const handleTypingActivity = () => {
        const convId = openConversationIdRef.current;
        if (!convId) return;

        const now = Date.now();
        // Send "typing: true" at most once per throttle window.
        if (now - lastTypingSentRef.current > TYPING_THROTTLE_MS) {
            sendTyping(convId, true);
            lastTypingSentRef.current = now;
        }

        // (Re)start the idle timer: if no key for TYPING_IDLE_MS, send "stopped".
        if (typingIdleTimerRef.current) clearTimeout(typingIdleTimerRef.current);
        typingIdleTimerRef.current = setTimeout(() => {
            sendTyping(convId, false);
            lastTypingSentRef.current = 0; // allow an immediate "true" next time
        }, TYPING_IDLE_MS);
    };

    // Immediately tell the server I've stopped typing in the given conversation.
    const stopTypingNow = (conversationId) => {
        if (typingIdleTimerRef.current) {
            clearTimeout(typingIdleTimerRef.current);
            typingIdleTimerRef.current = null;
        }
        if (lastTypingSentRef.current !== 0) {
            sendTyping(conversationId, false);
            lastTypingSentRef.current = 0;
        }
    };

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
            loadPresence(mapped.map((c) => c.userId));
        } catch {
            // Leave empty on failure.
        }
    };

    // Fetch presence for a batch of users (chat list / group members) in one call.
    const loadPresence = async (userIds) => {
        if (!userIds || userIds.length === 0) return;
        try {
            const response = await client.post("/api/presence", userIds);
            const map = {};
            (response.data.data || []).forEach((p) => {
                map[p.userId] = p;
            });
            setPresence((previous) => ({ ...previous, ...map }));
        } catch {
            // Leave presence empty on failure.
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
        const convId = dmConversationId(currentUserId, contact.userId);
        // Leaving the previous chat: stop any typing signal there.
        stopTypingNow(openConversationIdRef.current);
        setSelected({ type: "dm", userId: contact.userId, name: contact.name });
        openConversationIdRef.current = convId;
        setShowMembers(false);
        setMemberNames({});

        try {
            const response = await client.get(`/api/conversations/${contact.userId}`);
            setMessages(response.data.data);
        } catch {
            setMessages([]);
        }

        // Opening a chat means I've read everything in it.
        sendRead(convId);

        // Refresh this person's presence for the header.
        try {
            const res = await client.get(`/api/presence/${contact.userId}`);
            setPresence((previous) => ({ ...previous, [contact.userId]: res.data.data }));
        } catch {
            // Keep whatever we already have.
        }
    };

    const openGroup = async (group) => {
        const convId = groupConversationId(group.id);
        // Leaving the previous chat: stop any typing signal there.
        stopTypingNow(openConversationIdRef.current);
        setSelected({ type: "group", ...group });
        openConversationIdRef.current = convId;
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

            // Presence for the members, so the header can show "N online".
            loadPresence(members.map((member) => member.userId));
        } catch {
            setMessages([]);
            setMemberNames({});
        }

        // Opening the group means I've read everything in it.
        sendRead(convId);
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
        // Sending a message means I've stopped typing.
        stopTypingNow(openConversationIdRef.current);
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

    // The ids of people typing in the currently-open conversation.
    const typingHere = selected
        ? Object.keys(typing[openConversationIdRef.current] || {}).map(Number)
        : [];

    return (
        <div style={styles.page}>
            <aside style={styles.sidebar}>
                <div style={styles.sidebarHeader}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <HomeButton compact />
                        <h2 style={styles.sidebarTitle}>Pulse</h2>
                    </div>
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
                        <span style={styles.itemRow}>
                            <span>{contact.name || "Unknown"}</span>
                            <span
                                style={{
                                    ...styles.dot,
                                    background: presence[contact.userId]?.online
                                        ? "#00d96a"
                                        : "#3b4a54",
                                }}
                            />
                        </span>
                    </button>
                ))}
            </aside>

            <main style={styles.chat}>
                {!selected ? (
                    <div style={styles.placeholder}>Select a chat or group to start messaging.</div>
                ) : (
                    <>
                        <header style={styles.chatHeader}>
                            <div style={styles.headerInfo}>
                                <span style={styles.headerName}>{selected.name}</span>
                                <span style={styles.presenceLine}>
                                    {headerStatusLine(
                                        selected,
                                        typingHere,
                                        memberNames,
                                        presence,
                                        currentUserId
                                    )}
                                </span>
                            </div>
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

                                        <span style={styles.text}>{message.content}</span>

                                        <span style={styles.meta}>
                                            <span style={styles.time}>
                                                {formatTime(message.createdAt)}
                                            </span>
                                            {mine && <Ticks message={message} />}
                                        </span>
                                    </div>
                                );
                            })}
                            <div ref={bottomRef} />
                        </div>

                        <div style={styles.composer}>
                            <input
                                style={styles.input}
                                value={draft}
                                onChange={(e) => {
                                    setDraft(e.target.value);
                                    handleTypingActivity();
                                }}
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
    itemRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" },
    dot: {
        width: "9px",
        height: "9px",
        borderRadius: "50%",
        flex: "0 0 auto",
    },
    chat: { flex: 1, display: "flex", flexDirection: "column", background: "#0b141a" },
    placeholder: {
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#8696a0",
    },
    chatHeader: {
        padding: "10px 16px",
        borderBottom: "1px solid #222d34",
        color: "#e9edef",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
    },
    headerInfo: { display: "flex", flexDirection: "column" },
    headerName: { fontWeight: 600, fontSize: "15px" },
    presenceLine: { fontSize: "12px", color: "#8696a0", marginTop: "1px", minHeight: "14px" },
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
    bubble: {
        maxWidth: "65%",
        padding: "6px 10px 5px 12px",
        borderRadius: "12px",
        fontSize: "14px",
        lineHeight: 1.4,
        display: "flex",
        flexDirection: "column",
    },
    bubbleMine: { alignSelf: "flex-end", background: "#005c4b", color: "#e9edef" },
    bubbleTheirs: { alignSelf: "flex-start", background: "#202c33", color: "#e9edef" },
    sender: { fontSize: "12px", color: "#53bdeb", marginBottom: "2px", fontWeight: 600 },
    text: { whiteSpace: "pre-wrap", wordBreak: "break-word", textAlign: "left" },
    meta: {
        alignSelf: "flex-end",
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        marginTop: "2px",
        whiteSpace: "nowrap",
    },
    time: { fontSize: "11px", color: "#9fc1b8" },
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
