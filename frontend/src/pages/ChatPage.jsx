import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import HomeButton from "../components/HomeButton";
import client from "../api/client";
import { uploadMedia, getMessageType } from "../api/mediaApi";
import { reactToMessage, unreactToMessage } from "../api/reactionApi";
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

const TYPING_THROTTLE_MS = 2000;
const TYPING_IDLE_MS = 3000;
const TYPING_EXPIRE_MS = 4000;

function dmConversationId(a, b) {
    const smaller = Math.min(a, b);
    const larger = Math.max(a, b);
    return `dm:${smaller}:${larger}`;
}
function groupConversationId(groupId) {
    return `group:${groupId}`;
}

function formatTime(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

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

function presenceLabel(p) {
    if (!p) return "";
    if (p.online) return "online";
    if (p.lastSeen) return `last seen ${formatLastSeen(p.lastSeen)}`;
    return "";
}

function groupHeaderLabel(memberNames, presence, currentUserId) {
    const ids = Object.keys(memberNames).map(Number);
    if (ids.length === 0) return "";
    const online = ids.filter((id) => id !== currentUserId && presence[id]?.online).length;
    return online > 0 ? `${online} online` : `${ids.length} members`;
}

function headerStatusLine(selected, typingUserIds, memberNames, presence, currentUserId) {
    if (selected.type === "dm") {
        if (typingUserIds.length > 0) return "typing...";
        return presenceLabel(presence[selected.userId]);
    }
    const others = typingUserIds.filter((id) => id !== currentUserId);
    if (others.length > 0) {
        const names = others.map((id) => memberNames[id] || "Someone");
        if (names.length === 1) return `${names[0]} is typing...`;
        if (names.length === 2) return `${names[0]} and ${names[1]} are typing...`;
        return `${names[0]}, ${names[1]} and ${names.length - 2} others are typing...`;
    }
    return groupHeaderLabel(memberNames, presence, currentUserId);
}

function Ticks({ message }) {
    const status = message.status || "SENT";
    const isRead = status === "READ";
    const isDelivered = status === "DELIVERED" || isRead;
    const symbol = isDelivered ? "✓✓" : "✓";
    const color = isRead ? "#4fc3f7" : "#a8c5bd";
    return <span style={{ color, fontWeight: 700 }}>{symbol}</span>;
}

function Lightbox({ url, onClose }) {
    if (!url) return null;
    return (
        <div style={styles.lightboxOverlay} onClick={onClose}>
            <button style={styles.lightboxClose} onClick={onClose}>✕</button>
            <img
                src={url}
                alt="preview"
                style={styles.lightboxImg}
                onClick={(e) => e.stopPropagation()}
            />
        </div>
    );
}

function MessageContent({ message, onImageClick }) {
    const { type, mediaUrl, content } = message;

    if (type === "IMAGE") {
        return (
            <div>
                <img
                    src={mediaUrl}
                    alt="image"
                    style={styles.mediaImage}
                    onClick={() => onImageClick(mediaUrl)}
                />
                {content && <p style={styles.caption}>{content}</p>}
            </div>
        );
    }
    if (type === "VIDEO") {
        return (
            <div>
                <video src={mediaUrl} controls style={styles.mediaVideo} />
                {content && <p style={styles.caption}>{content}</p>}
            </div>
        );
    }
    if (type === "AUDIO") {
        return (
            <div>
                <audio src={mediaUrl} controls style={styles.mediaAudio} />
                {content && <p style={styles.caption}>{content}</p>}
            </div>
        );
    }
    if (type === "FILE") {
        const filename = mediaUrl ? mediaUrl.split("/").pop() : "file";
        return (
            <div>
                <a href={mediaUrl} target="_blank" rel="noreferrer" style={styles.fileLink}>
                    📎 {filename}
                </a>
                {content && <p style={styles.caption}>{content}</p>}
            </div>
        );
    }
    return <span style={styles.text}>{content}</span>;
}

function mediaPreviewLabel(type) {
    if (type === "IMAGE") return "📷 Photo";
    if (type === "VIDEO") return "🎥 Video";
    if (type === "AUDIO") return "🎵 Audio";
    if (type === "FILE") return "📎 File";
    return "";
}

function QuotedMessage({ message, currentUserId, onJump }) {
    if (!message.replyToId) return null;
    const fromMe = message.replyToSenderId === currentUserId;
    const who = message.replyToDeleted ? "" : fromMe ? "You" : message.replyToSenderName || "Unknown";
    let preview;
    if (message.replyToDeleted) {
        preview = "This message was deleted";
    } else if (message.replyToContent) {
        preview = message.replyToContent;
    } else {
        preview = mediaPreviewLabel(message.replyToType);
    }
    return (
        <div
            style={styles.quoteBlock}
            onClick={(e) => { e.stopPropagation(); onJump?.(message.replyToId); }}
        >
            {who && <div style={styles.quoteAuthor}>{who}</div>}
            <div style={{ ...styles.quoteText, ...(message.replyToDeleted ? styles.quoteDeleted : {}) }}>
                {preview}
            </div>
        </div>
    );
}

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

function ReactionPills({ reactions, currentUserId, onToggle }) {
    if (!reactions || reactions.length === 0) return null;
    const groups = {};
    for (const r of reactions) {
        const g = groups[r.emoji] || { count: 0, mine: false };
        g.count += 1;
        if (r.userId === currentUserId) g.mine = true;
        groups[r.emoji] = g;
    }
    return (
        <div style={styles.pillRow}>
            {Object.entries(groups).map(([emoji, g]) => (
                <button
                    key={emoji}
                    style={{ ...styles.pill, ...(g.mine ? styles.pillMine : {}) }}
                    onClick={() => onToggle(emoji, g.mine)}
                    title={g.mine ? "Tap to remove your reaction" : "Tap to react"}
                >
                    <span>{emoji}</span>
                    <span style={styles.pillCount}>{g.count}</span>
                </button>
            ))}
        </div>
    );
}

export default function ChatPage() {
    const { user } = useAuth();
    const currentUserId = user?.userId;

    const [contacts, setContacts] = useState([]);
    const [groups, setGroups] = useState([]);
    const [selected, setSelected] = useState(null);
    const [messages, setMessages] = useState([]);
    const [draft, setDraft] = useState("");
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [unreadCounts, setUnreadCounts] = useState({});
    const [memberNames, setMemberNames] = useState({});
    const [presence, setPresence] = useState({});
    const [typing, setTyping] = useState({});
    const [, setNowTick] = useState(0);
    const [showNewGroup, setShowNewGroup] = useState(false);
    const [showMembers, setShowMembers] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [lightboxUrl, setLightboxUrl] = useState(null);
    const [replyingTo, setReplyingTo] = useState(null);
    const [emojiPickerFor, setEmojiPickerFor] = useState(null);
    const [hoveredMessageId, setHoveredMessageId] = useState(null);
    const [menuFor, setMenuFor] = useState(null);

    const openConversationIdRef = useRef(null);
    const bottomRef = useRef(null);
    const scrollRef = useRef(null);
    const shouldScrollToBottom = useRef(true);
    const currentUserIdRef = useRef(null);
    const windowFocusedRef = useRef(typeof document === "undefined" ? true : document.hasFocus());
    const pendingReadRef = useRef(null);
    const fileInputRef = useRef(null);
    const messageRefs = useRef({});
    const lastTypingSentRef = useRef(0);
    const typingIdleTimerRef = useRef(null);
    const typingExpiryTimersRef = useRef({});

    useEffect(() => { currentUserIdRef.current = currentUserId; }, [currentUserId]);

    useEffect(() => {
        if (!selected) {
            sessionStorage.removeItem("pulse_selected");
        } else if (selected.type === "dm") {
            sessionStorage.setItem("pulse_selected", JSON.stringify({ type: "dm", userId: selected.userId }));
        } else if (selected.type === "group") {
            sessionStorage.setItem("pulse_selected", JSON.stringify({ type: "group", id: selected.id }));
        }
    }, [selected]);

    useEffect(() => {
        const timer = setInterval(() => setNowTick((n) => n + 1), 60000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const init = async () => {
            const [loadedContacts, loadedGroups] = await Promise.all([
                loadContacts(), loadGroups(), loadUnreadCounts(),
            ]);
            const saved = sessionStorage.getItem("pulse_selected");
            if (saved) {
                try {
                    const { type, userId, id } = JSON.parse(saved);
                    if (type === "dm") {
                        const contact = loadedContacts.find((c) => c.userId === userId);
                        if (contact) openDirect(contact);
                    } else if (type === "group") {
                        const group = loadedGroups.find((g) => g.id === id);
                        if (group) openGroup(group);
                    }
                } catch { /* ignore bad data */ }
            }
        };
        init();

        connectWebSocket(
            (message) => {
                const mine = message.senderId === currentUserIdRef.current;
                if (mine) {
                    if (message.conversationId === openConversationIdRef.current) {
                        setMessages((prev) => [...prev, message]);
                        shouldScrollToBottom.current = true;
                    }
                    return;
                }
                clearTyping(message.conversationId, message.senderId);
                if (message.conversationId === openConversationIdRef.current) {
                    setMessages((prev) => [...prev, message]);
                    shouldScrollToBottom.current = true;
                    if (windowFocusedRef.current) {
                        sendRead(message.conversationId);
                    } else {
                        sendDelivered(message.conversationId);
                        pendingReadRef.current = message.conversationId;
                    }
                } else {
                    sendDelivered(message.conversationId);
                    setUnreadCounts((prev) => ({
                        ...prev,
                        [message.conversationId]: (prev[message.conversationId] || 0) + 1,
                    }));
                }
            },
            (update) => {
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === update.messageId
                            ? { ...m, status: update.status, deliveredCount: update.deliveredCount, readCount: update.readCount, totalRecipients: update.totalRecipients }
                            : m
                    )
                );
            },
            (p) => {
                setPresence((prev) => ({ ...prev, [p.userId]: p }));
            },
            (event) => {
                if (event.typing) {
                    markTyping(event.conversationId, event.userId);
                } else {
                    clearTyping(event.conversationId, event.userId);
                }
            },
            (update) => {
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === update.messageId ? { ...m, reactions: update.reactions } : m
                    )
                );
            }
        );

        return () => {
            disconnectWebSocket();
            if (typingIdleTimerRef.current) clearTimeout(typingIdleTimerRef.current);
            Object.values(typingExpiryTimersRef.current).forEach(clearTimeout);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (shouldScrollToBottom.current) {
            bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

    useEffect(() => {
        const onFocus = () => {
            windowFocusedRef.current = true;
            if (pendingReadRef.current) {
                const convId = pendingReadRef.current;
                pendingReadRef.current = null;
                if (convId === openConversationIdRef.current) sendRead(convId);
            }
        };
        const onBlur = () => { windowFocusedRef.current = false; };
        window.addEventListener("focus", onFocus);
        window.addEventListener("blur", onBlur);
        return () => { window.removeEventListener("focus", onFocus); window.removeEventListener("blur", onBlur); };
    }, []);

    useEffect(() => {
        if (menuFor === null && emojiPickerFor === null) return;
        const onDocClick = () => { setMenuFor(null); setEmojiPickerFor(null); };
        document.addEventListener("click", onDocClick);
        return () => document.removeEventListener("click", onDocClick);
    }, [menuFor, emojiPickerFor]);

    const markReadIfFocused = (conversationId) => {
        if (windowFocusedRef.current) {
            sendRead(conversationId);
        } else {
            pendingReadRef.current = conversationId;
        }
    };

    const markTyping = (conversationId, userId) => {
        const key = `${conversationId}:${userId}`;
        if (typingExpiryTimersRef.current[key]) clearTimeout(typingExpiryTimersRef.current[key]);
        typingExpiryTimersRef.current[key] = setTimeout(() => clearTyping(conversationId, userId), TYPING_EXPIRE_MS);
        setTyping((prev) => {
            const forConvo = prev[conversationId] || {};
            if (forConvo[userId]) return prev;
            return { ...prev, [conversationId]: { ...forConvo, [userId]: true } };
        });
    };

    const clearTyping = (conversationId, userId) => {
        const key = `${conversationId}:${userId}`;
        if (typingExpiryTimersRef.current[key]) {
            clearTimeout(typingExpiryTimersRef.current[key]);
            delete typingExpiryTimersRef.current[key];
        }
        setTyping((prev) => {
            const forConvo = prev[conversationId];
            if (!forConvo || !forConvo[userId]) return prev;
            const next = { ...forConvo };
            delete next[userId];
            return { ...prev, [conversationId]: next };
        });
    };

    const handleTypingActivity = () => {
        const convId = openConversationIdRef.current;
        if (!convId) return;
        const now = Date.now();
        if (now - lastTypingSentRef.current > TYPING_THROTTLE_MS) {
            sendTyping(convId, true);
            lastTypingSentRef.current = now;
        }
        if (typingIdleTimerRef.current) clearTimeout(typingIdleTimerRef.current);
        typingIdleTimerRef.current = setTimeout(() => {
            sendTyping(convId, false);
            lastTypingSentRef.current = 0;
        }, TYPING_IDLE_MS);
    };

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

    // ── Load unread counts for all conversations ──────────────────────────────
    const loadUnreadCounts = async () => {
        try {
            const res = await client.get("/api/conversations/unread-counts");
            setUnreadCounts(res.data.data || {});
        } catch { /* non-fatal */ }
    };

    // ── Load older messages on scroll-up ─────────────────────────────────────
    // Saves scrollHeight before prepending, restores offset after DOM update
    // so the viewport doesn't jump.
    const loadOlderMessages = async () => {
        if (!hasMore || loadingMore || messages.length === 0) return;
        const container = scrollRef.current;
        const oldScrollHeight = container.scrollHeight;
        const oldScrollTop = container.scrollTop;
        const oldestId = messages[0].id;
        setLoadingMore(true);
        shouldScrollToBottom.current = false;
        try {
            let response;
            if (selected.type === "dm") {
                response = await client.get(`/api/conversations/${selected.userId}?before=${oldestId}`);
            } else {
                response = await client.get(`/api/conversations/group/${selected.id}?before=${oldestId}`);
            }
            const { messages: older, hasMore: more } = response.data.data;
            setHasMore(more);
            if (older.length > 0) {
                setMessages((prev) => [...older, ...prev]);
                requestAnimationFrame(() => {
                    if (container) {
                        container.scrollTop = container.scrollHeight - oldScrollHeight + oldScrollTop;
                    }
                });
            }
        } catch { /* silent */ }
        finally { setLoadingMore(false); }
    };

    const loadContacts = async () => {
        try {
            const response = await client.get("/api/v1/contacts");
            const mapped = (response.data.data || []).map((c) => ({
                userId: c.contactId,
                name: c.alias || c.name,
                avatarUrl: c.avatarUrl,
            }));
            setContacts(mapped);
            loadPresence(mapped.map((c) => c.userId));
            return mapped;
        } catch {
            return [];
        }
    };

    const loadPresence = async (userIds) => {
        if (!userIds || userIds.length === 0) return;
        try {
            const response = await client.post("/api/presence", userIds);
            const map = {};
            (response.data.data || []).forEach((p) => { map[p.userId] = p; });
            setPresence((prev) => ({ ...prev, ...map }));
        } catch { /* leave presence empty */ }
    };

    const loadGroups = async () => {
        try {
            const data = await listGroups();
            setGroups(data);
            return data;
        } catch {
            return [];
        }
    };

    const openDirect = async (contact) => {
        const convId = dmConversationId(currentUserId, contact.userId);
        stopTypingNow(openConversationIdRef.current);
        setReplyingTo(null);
        setSelected({ type: "dm", userId: contact.userId, name: contact.name });
        openConversationIdRef.current = convId;
        setShowMembers(false);
        setMemberNames({});
        try {
            const response = await client.get(`/api/conversations/${contact.userId}`);
            const { messages: batch, hasMore: more } = response.data.data;
            shouldScrollToBottom.current = true;
            setMessages(batch);
            setHasMore(more);
        } catch {
            setMessages([]);
            setHasMore(false);
        }
        markReadIfFocused(convId);
        setUnreadCounts((prev) => ({ ...prev, [convId]: 0 }));
        try {
            const res = await client.get(`/api/presence/${contact.userId}`);
            setPresence((prev) => ({ ...prev, [contact.userId]: res.data.data }));
        } catch { /* keep existing presence */ }
    };

    const openGroup = async (group) => {
        const convId = groupConversationId(group.id);
        stopTypingNow(openConversationIdRef.current);
        setReplyingTo(null);
        setSelected({ type: "group", ...group });
        openConversationIdRef.current = convId;
        setShowMembers(false);
        try {
            const [history, members] = await Promise.all([
                getGroupHistory(group.id),
                getGroupMembers(group.id),
            ]);
            const { messages: batch, hasMore: more } = history;
            shouldScrollToBottom.current = true;
            setMessages(batch);
            setHasMore(more);
            const names = {};
            members.forEach((m) => { names[m.userId] = m.name; });
            setMemberNames(names);
            loadPresence(members.map((m) => m.userId));
        } catch {
            setMessages([]);
            setMemberNames({});
        }
        markReadIfFocused(convId);
        setUnreadCounts((prev) => ({ ...prev, [convId]: 0 }));
    };

    const startReply = (message) => {
        setReplyingTo({
            id: message.id,
            senderId: message.senderId,
            senderName: message.senderId === currentUserId
                ? "You"
                : memberNames[message.senderId] || selected?.name || "Unknown",
            content: message.content,
            type: message.type,
        });
    };

    const cancelReply = () => setReplyingTo(null);

    const jumpToMessage = (messageId) => {
        const node = messageRefs.current[messageId];
        if (!node) return;
        node.scrollIntoView({ behavior: "smooth", block: "center" });
        node.style.transition = "background 0.4s";
        const original = node.style.background;
        node.style.background = "#3a4a3f";
        setTimeout(() => { node.style.background = original; }, 800);
    };

    const toggleReaction = async (messageId, emoji, mine) => {
        try {
            if (mine) await unreactToMessage(messageId);
            else await reactToMessage(messageId, emoji);
        } catch (error) { console.error("Reaction failed:", error); }
    };

    const pickReaction = async (messageId, emoji) => {
        setEmojiPickerFor(null);
        try { await reactToMessage(messageId, emoji); }
        catch (error) { console.error("Reaction failed:", error); }
    };

    const handleSend = () => {
        const text = draft.trim();
        if (!text || !selected) return;
        const replyToId = replyingTo ? replyingTo.id : null;
        if (selected.type === "dm") {
            sendMessage(selected.userId, text, "TEXT", null, replyToId);
        } else {
            sendGroupMessage(selected.id, text, "TEXT", null, replyToId);
        }
        setDraft("");
        setReplyingTo(null);
        stopTypingNow(openConversationIdRef.current);
    };

    const handleFileSelected = async (event) => {
        const file = event.target.files[0];
        if (!file || !selected) return;
        event.target.value = "";
        const messageType = getMessageType(file);
        setIsUploading(true);
        try {
            const mediaUrl = await uploadMedia(file);
            const replyToId = replyingTo ? replyingTo.id : null;
            if (selected.type === "dm") {
                sendMessage(selected.userId, "", messageType, mediaUrl, replyToId);
            } else {
                sendGroupMessage(selected.id, "", messageType, mediaUrl, replyToId);
            }
            setReplyingTo(null);
        } catch (error) {
            console.error("Media upload failed:", error);
            alert("Upload failed. Please try again.");
        } finally {
            setIsUploading(false);
        }
        stopTypingNow(openConversationIdRef.current);
    };

    const handleGroupCreated = (group) => {
        setGroups((prev) => [group, ...prev]);
        setShowNewGroup(false);
        openGroup(group);
    };

    const handleLeftGroup = () => {
        setGroups((prev) => prev.filter((g) => g.id !== selected.id));
        setSelected(null);
        setMessages([]);
        openConversationIdRef.current = null;
        setShowMembers(false);
    };

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
                {groups.map((group) => {
                    const convId = groupConversationId(group.id);
                    const unread = unreadCounts[convId] || 0;
                    return (
                        <button
                            key={`g-${group.id}`}
                            style={{
                                ...styles.item,
                                ...(selected?.type === "group" && selected.id === group.id ? styles.itemActive : {}),
                            }}
                            onClick={() => openGroup(group)}
                        >
                            <span style={styles.itemRow}>
                                <span># {group.name}</span>
                                {unread > 0 && (
                                    <span style={styles.unreadBadge}>{unread > 99 ? "99+" : unread}</span>
                                )}
                            </span>
                        </button>
                    );
                })}

                <p style={styles.sectionLabel}>Chats</p>
                {contacts.length === 0 && <p style={styles.empty}>No contacts yet.</p>}
                {contacts.map((contact) => {
                    const convId = dmConversationId(currentUserId, contact.userId);
                    const unread = unreadCounts[convId] || 0;
                    return (
                        <button
                            key={`c-${contact.userId}`}
                            style={{
                                ...styles.item,
                                ...(selected?.type === "dm" && selected.userId === contact.userId ? styles.itemActive : {}),
                            }}
                            onClick={() => openDirect(contact)}
                        >
                            <span style={styles.itemRow}>
                                <span>{contact.name || "Unknown"}</span>
                                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    {unread > 0 && (
                                        <span style={styles.unreadBadge}>{unread > 99 ? "99+" : unread}</span>
                                    )}
                                    <span
                                        style={{
                                            ...styles.dot,
                                            background: presence[contact.userId]?.online ? "#00d96a" : "#3b4a54",
                                        }}
                                    />
                                </span>
                            </span>
                        </button>
                    );
                })}
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
                                    {headerStatusLine(selected, typingHere, memberNames, presence, currentUserId)}
                                </span>
                            </div>
                            {selected.type === "group" && (
                                <button style={styles.infoBtn} onClick={() => setShowMembers((v) => !v)}>
                                    Members
                                </button>
                            )}
                        </header>

                        <div
                            ref={scrollRef}
                            style={styles.messages}
                            onScroll={(e) => {
                                if (e.target.scrollTop < 80) loadOlderMessages();
                            }}
                        >
                            {loadingMore && (
                                <div style={styles.loadingMore}>Loading older messages…</div>
                            )}
                            {!loadingMore && hasMore && messages.length > 0 && (
                                <div style={styles.loadMoreHint}>↑ Scroll up for older messages</div>
                            )}

                            {messages.map((message) => {
                                const mine = message.senderId === currentUserId;
                                const showSender = selected.type === "group" && !mine;
                                const hovered = hoveredMessageId === message.id;
                                const menuOpen = menuFor === message.id;
                                const pickerOpen = emojiPickerFor === message.id;
                                return (
                                    <div
                                        key={message.id}
                                        style={{
                                            ...styles.row,
                                            alignSelf: mine ? "flex-end" : "flex-start",
                                            alignItems: mine ? "flex-end" : "flex-start",
                                        }}
                                        onMouseEnter={() => setHoveredMessageId(message.id)}
                                        onMouseLeave={() => setHoveredMessageId(null)}
                                    >
                                        <div
                                            ref={(node) => {
                                                if (node) messageRefs.current[message.id] = node;
                                                else delete messageRefs.current[message.id];
                                            }}
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

                                            {message.statusPreview && (
                                                <div style={styles.statusPreview}>
                                                    {message.statusPreview.mediaUrl && (
                                                        <img
                                                            src={message.statusPreview.mediaUrl}
                                                            alt="status"
                                                            style={styles.previewImg}
                                                        />
                                                    )}
                                                    <div style={styles.previewBody}>
                                                        <span style={styles.previewAuthor}>
                                                            {message.statusPreview.authorName}'s status
                                                        </span>
                                                        {message.statusPreview.content && (
                                                            <span style={styles.previewText}>
                                                                {message.statusPreview.content.length > 60
                                                                    ? message.statusPreview.content.slice(0, 60) + "…"
                                                                    : message.statusPreview.content}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            <QuotedMessage
                                                message={message}
                                                currentUserId={currentUserId}
                                                onJump={jumpToMessage}
                                            />

                                            <MessageContent message={message} onImageClick={setLightboxUrl} />

                                            <span style={styles.meta}>
                                                <span style={styles.time}>{formatTime(message.createdAt)}</span>
                                                {mine && <Ticks message={message} />}
                                            </span>

                                            {(hovered || menuOpen || pickerOpen) && (
                                                <button
                                                    style={{
                                                        ...styles.chevron,
                                                        ...(mine ? styles.chevronMine : styles.chevronTheirs),
                                                    }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEmojiPickerFor(null);
                                                        setMenuFor(menuOpen ? null : message.id);
                                                    }}
                                                    title="More"
                                                >
                                                    ⌄
                                                </button>
                                            )}

                                            {menuOpen && (
                                                <div style={styles.actionMenu} onClick={(e) => e.stopPropagation()}>
                                                    <button
                                                        style={styles.actionMenuItem}
                                                        onClick={() => { setMenuFor(null); setEmojiPickerFor(message.id); }}
                                                    >
                                                        React
                                                    </button>
                                                    <button
                                                        style={styles.actionMenuItem}
                                                        onClick={() => { setMenuFor(null); startReply(message); }}
                                                    >
                                                        Reply
                                                    </button>
                                                </div>
                                            )}

                                            {pickerOpen && (
                                                <div style={styles.emojiPopover} onClick={(e) => e.stopPropagation()}>
                                                    {QUICK_EMOJIS.map((emoji) => (
                                                        <button
                                                            key={emoji}
                                                            style={styles.emojiChoice}
                                                            onClick={() => pickReaction(message.id, emoji)}
                                                        >
                                                            {emoji}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <ReactionPills
                                            reactions={message.reactions}
                                            currentUserId={currentUserId}
                                            onToggle={(emoji, isMine) => toggleReaction(message.id, emoji, isMine)}
                                        />
                                    </div>
                                );
                            })}
                            <div ref={bottomRef} />
                        </div>

                        <div style={styles.composerWrap}>
                            {replyingTo && (
                                <div style={styles.replyBar}>
                                    <div style={styles.replyBarBody}>
                                        <div style={styles.replyBarAuthor}>
                                            Replying to {replyingTo.senderName}
                                        </div>
                                        <div style={styles.replyBarText}>
                                            {replyingTo.content ? replyingTo.content : mediaPreviewLabel(replyingTo.type)}
                                        </div>
                                    </div>
                                    <button style={styles.replyBarClose} onClick={cancelReply} title="Cancel reply">
                                        ✕
                                    </button>
                                </div>
                            )}

                            <div style={styles.composer}>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    style={{ display: "none" }}
                                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
                                    onChange={handleFileSelected}
                                />
                                <button
                                    style={styles.attachButton}
                                    onClick={() => fileInputRef.current.click()}
                                    disabled={isUploading}
                                    title="Attach a file"
                                >
                                    📎
                                </button>
                                <input
                                    style={styles.input}
                                    value={isUploading ? "Uploading..." : draft}
                                    onChange={(e) => { setDraft(e.target.value); handleTypingActivity(); }}
                                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                                    placeholder="Type a message"
                                    disabled={isUploading}
                                />
                                <button style={styles.sendButton} onClick={handleSend} disabled={isUploading}>
                                    Send
                                </button>
                            </div>
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

            <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
        </div>
    );
}

const styles = {
    page: { display: "flex", height: "100vh", background: "#0b141a", color: "#e9edef" },
    sidebar: { width: "280px", borderRight: "1px solid #222d34", overflowY: "auto", padding: "12px", background: "#111b21" },
    sidebarHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", margin: "4px 8px 12px" },
    sidebarTitle: { fontSize: "18px", margin: 0, color: "#e9edef" },
    newGroupBtn: { fontSize: "12px", padding: "6px 10px", border: "none", borderRadius: "6px", background: "#00a884", color: "#fff", cursor: "pointer" },
    sectionLabel: { fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px", color: "#8696a0", margin: "14px 8px 6px" },
    empty: { fontSize: "14px", color: "#8696a0", padding: "0 8px" },
    item: { display: "block", width: "100%", textAlign: "left", padding: "10px 8px", border: "none", background: "transparent", cursor: "pointer", fontSize: "15px", borderRadius: "6px", color: "#e9edef" },
    itemActive: { background: "#2a3942" },
    itemRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" },
    dot: { width: "9px", height: "9px", borderRadius: "50%", flex: "0 0 auto" },
    unreadBadge: { background: "#00a884", color: "#fff", fontSize: "11px", fontWeight: 700, borderRadius: "10px", padding: "2px 6px", minWidth: "18px", textAlign: "center" },
    chat: { flex: 1, display: "flex", flexDirection: "column", background: "#0b141a" },
    placeholder: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#8696a0" },
    chatHeader: { padding: "10px 16px", borderBottom: "1px solid #222d34", color: "#e9edef", display: "flex", alignItems: "center", justifyContent: "space-between" },
    headerInfo: { display: "flex", flexDirection: "column" },
    headerName: { fontWeight: 600, fontSize: "15px" },
    presenceLine: { fontSize: "12px", color: "#8696a0", marginTop: "1px", minHeight: "14px" },
    infoBtn: { fontSize: "13px", padding: "6px 12px", border: "1px solid #2a3942", borderRadius: "6px", background: "transparent", color: "#e9edef", cursor: "pointer" },
    messages: { flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "10px" },
    loadingMore: { textAlign: "center", fontSize: "12px", color: "#8696a0", padding: "8px 0" },
    loadMoreHint: { textAlign: "center", fontSize: "11px", color: "#3a4a54", padding: "4px 0" },
    row: { display: "flex", flexDirection: "column", maxWidth: "65%" },
    bubble: { position: "relative", maxWidth: "100%", padding: "6px 26px 5px 12px", borderRadius: "12px", fontSize: "14px", lineHeight: 1.4, display: "flex", flexDirection: "column" },
    bubbleMine: { background: "#005c4b", color: "#e9edef" },
    bubbleTheirs: { background: "#202c33", color: "#e9edef" },
    sender: { fontSize: "12px", color: "#53bdeb", marginBottom: "2px", fontWeight: 600 },
    statusPreview: { display: "flex", alignItems: "center", gap: 8, background: "rgba(0,0,0,0.2)", borderLeft: "3px solid #00a884", borderRadius: "4px", padding: "6px 8px", marginBottom: 6, overflow: "hidden" },
    previewImg: { width: 40, height: 40, borderRadius: 4, objectFit: "cover", flexShrink: 0 },
    previewBody: { display: "flex", flexDirection: "column", gap: 2, minWidth: 0 },
    previewAuthor: { fontSize: 11, color: "#00a884", fontWeight: 600 },
    previewText: { fontSize: 12, color: "#a8c5bd", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    text: { whiteSpace: "pre-wrap", wordBreak: "break-word", textAlign: "left" },
    meta: { alignSelf: "flex-end", display: "inline-flex", alignItems: "center", gap: "4px", marginTop: "2px", whiteSpace: "nowrap" },
    time: { fontSize: "11px", color: "#9fc1b8" },
    chevron: { position: "absolute", top: "3px", right: "3px", border: "none", borderRadius: "50%", width: "18px", height: "18px", lineHeight: "14px", fontSize: "13px", cursor: "pointer", color: "#cdd6dd", background: "rgba(0,0,0,0.28)", padding: 0 },
    chevronMine: {},
    chevronTheirs: {},
    actionMenu: { position: "absolute", top: "24px", right: "2px", zIndex: 20, display: "flex", flexDirection: "column", minWidth: "120px", background: "#233138", border: "1px solid #2a3942", borderRadius: "8px", boxShadow: "0 4px 14px rgba(0,0,0,0.4)", overflow: "hidden" },
    actionMenuItem: { border: "none", background: "transparent", color: "#e9edef", textAlign: "left", padding: "8px 14px", fontSize: "14px", cursor: "pointer" },
    pillRow: { display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "3px" },
    pill: { display: "inline-flex", alignItems: "center", gap: "3px", border: "1px solid #2a3942", background: "#1d282f", borderRadius: "11px", padding: "1px 7px", fontSize: "12px", cursor: "pointer", color: "#e9edef", lineHeight: 1.6 },
    pillMine: { border: "1px solid #00a884", background: "#0c3a30" },
    pillCount: { fontSize: "11px", color: "#c5cdd3" },
    emojiPopover: { position: "absolute", top: "24px", right: "2px", zIndex: 20, display: "flex", gap: "2px", padding: "4px 6px", background: "#233138", border: "1px solid #2a3942", borderRadius: "22px", boxShadow: "0 4px 14px rgba(0,0,0,0.4)" },
    emojiChoice: { border: "none", background: "transparent", cursor: "pointer", fontSize: "20px", lineHeight: 1, padding: "2px 4px", borderRadius: "6px" },
    quoteBlock: { borderLeft: "3px solid #53bdeb", background: "rgba(255,255,255,0.06)", borderRadius: "4px", padding: "4px 8px", marginBottom: "4px", cursor: "pointer", maxWidth: "100%" },
    quoteAuthor: { fontSize: "12px", fontWeight: 600, color: "#53bdeb", marginBottom: "1px" },
    quoteText: { fontSize: "12.5px", color: "#c5cdd3", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "260px" },
    quoteDeleted: { fontStyle: "italic", color: "#8696a0" },
    composerWrap: { borderTop: "1px solid #222d34", background: "#111b21" },
    replyBar: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", padding: "8px 12px 0" },
    replyBarBody: { flex: 1, borderLeft: "3px solid #00a884", background: "#1d282f", borderRadius: "4px", padding: "4px 8px", overflow: "hidden" },
    replyBarAuthor: { fontSize: "12px", fontWeight: 600, color: "#00a884" },
    replyBarText: { fontSize: "12.5px", color: "#c5cdd3", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    replyBarClose: { border: "none", background: "transparent", color: "#8696a0", cursor: "pointer", fontSize: "16px", lineHeight: 1, padding: "4px" },
    mediaImage: { maxWidth: "240px", maxHeight: "240px", borderRadius: "8px", cursor: "pointer", display: "block", marginBottom: "4px" },
    mediaVideo: { maxWidth: "280px", borderRadius: "8px", display: "block", marginBottom: "4px" },
    mediaAudio: { maxWidth: "260px", display: "block", marginBottom: "4px" },
    fileLink: { color: "#53bdeb", textDecoration: "none", display: "block", marginBottom: "4px" },
    caption: { margin: "4px 0 0", fontSize: "13px" },
    composer: { display: "flex", gap: "8px", padding: "12px" },
    attachButton: { padding: "10px 12px", border: "none", borderRadius: "6px", background: "#2a3942", color: "#e9edef", cursor: "pointer", fontSize: "16px" },
    input: { flex: 1, padding: "10px", fontSize: "14px", border: "1px solid #2a3942", borderRadius: "6px", background: "#2a3942", color: "#e9edef", outline: "none" },
    sendButton: { padding: "10px 18px", border: "none", borderRadius: "6px", cursor: "pointer", background: "#00a884", color: "#fff" },
    lightboxOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
    lightboxImg: { maxWidth: "90vw", maxHeight: "90vh", borderRadius: "8px", objectFit: "contain" },
    lightboxClose: { position: "absolute", top: "16px", right: "20px", background: "none", border: "none", color: "#fff", fontSize: "28px", cursor: "pointer", lineHeight: 1 },
};