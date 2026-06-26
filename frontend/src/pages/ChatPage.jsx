import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import { useSocket } from "../context/SocketContext";
import NotificationToast from "../components/NotificationToast";
import HomeButton from "../components/HomeButton";
import client from "../api/client";
import { uploadMedia, getMessageType } from "../api/mediaApi";
import { reactToMessage, unreactToMessage } from "../api/reactionApi";
import { deleteForMe, deleteForEveryone, editMessage } from "../api/messageActionApi";
import {
    sendMessage,
    sendGroupMessage,
    sendDelivered,
    sendRead,
    sendTyping,
} from "../services/WebSocket.js";
import { listGroups, getGroupHistory, getGroupMembers } from "../api/groupApi";
import { blockUser, unblockUser, getBlockStatus } from "../api/blockApi";
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
    const color = isRead ? "#4fc3f7" : "var(--c-tick2)";
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
    const who = message.replyToDeleted
        ? ""
        : fromMe
            ? "You"
            : message.replyToSenderName || "Unknown";

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
            onClick={(e) => {
                e.stopPropagation();
                onJump?.(message.replyToId);
            }}
        >
            {who && <div style={styles.quoteAuthor}>{who}</div>}
            <div
                style={{
                    ...styles.quoteText,
                    ...(message.replyToDeleted ? styles.quoteDeleted : {}),
                }}
            >
                {preview}
            </div>
        </div>
    );
}

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

function ReactionPills({ reactions, currentUserId, onToggle, alignRight }) {
    if (!reactions || reactions.length === 0) return null;

    const groups = {};
    for (const r of reactions) {
        const g = groups[r.emoji] || { count: 0, mine: false };
        g.count += 1;
        if (r.userId === currentUserId) g.mine = true;
        groups[r.emoji] = g;
    }

    const rowStyle = {
        ...styles.pillRow,
        justifyContent: alignRight ? "flex-end" : "flex-start",
    };

    return (
        <div style={rowStyle}>
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
    const navigate = useNavigate();
    const { clearConversation, unreadPerConversation } = useNotification();
    const { presence, setPresence, activeToast, setActiveToast, addListener, setOpenConversation } = useSocket();

    const [contacts, setContacts] = useState([]);
    const [extraChats, setExtraChats] = useState([]);
    const [groups, setGroups] = useState([]);
    const [lastMessageAt, setLastMessageAt] = useState({});
    const [chatSearch, setChatSearch] = useState("");
    const [hidden, setHidden] = useState({});
    const [hoveredChatId, setHoveredChatId] = useState(null);

    const [selected, setSelected] = useState(null);

    const [messages, setMessages] = useState([]);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [draft, setDraft] = useState("");

    const [editingMessage, setEditingMessage] = useState(null);

    const [memberNames, setMemberNames] = useState({});

    const [typing, setTyping] = useState({});

    const [, setNowTick] = useState(0);

    const [showNewGroup, setShowNewGroup] = useState(false);
    const [showMembers, setShowMembers] = useState(false);
    const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
    const [isBlocked, setIsBlocked] = useState(false);

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
    const contactsRef = useRef([]);
    const extraChatsRef = useRef([]);
    const loadPartnersRef = useRef(null);

    const windowFocusedRef = useRef(
        typeof document === "undefined" ? true : document.hasFocus()
    );

    const pendingReadRef = useRef(null);

    const fileInputRef = useRef(null);

    const messageRefs = useRef({});

    const lastTypingSentRef = useRef(0);
    const typingIdleTimerRef = useRef(null);

    const typingExpiryTimersRef = useRef({});

    useEffect(() => {
        currentUserIdRef.current = currentUserId;
    }, [currentUserId]);

    useEffect(() => {
        contactsRef.current = contacts;
    }, [contacts]);

    useEffect(() => {
        extraChatsRef.current = extraChats;
    }, [extraChats]);

    useEffect(() => {
        loadPartnersRef.current = loadPartners;
    });

    useEffect(() => {
        setOpenConversation(openConversationIdRef.current);
        if (!selected) {
            sessionStorage.removeItem("pulse_selected");
        } else if (selected.type === "dm") {
            sessionStorage.setItem("pulse_selected", JSON.stringify({ type: "dm", userId: selected.userId }));
        } else if (selected.type === "group") {
            sessionStorage.setItem("pulse_selected", JSON.stringify({ type: "group", id: selected.id }));
        }
    }, [selected, setOpenConversation]);

    useEffect(() => {
        return () => setOpenConversation(null);
    }, [setOpenConversation]);

    useEffect(() => {
        const timer = setInterval(() => setNowTick((n) => n + 1), 60000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const init = async () => {
            const [loadedContacts, loadedGroups] = await Promise.all([loadContacts(), loadGroups()]);
            contactsRef.current = loadedContacts;
            loadPartners();
            loadSummaries();
            loadHidden();

            const saved = sessionStorage.getItem("pulse_selected");
            if (saved) {
                try {
                    const { type, userId, id } = JSON.parse(saved);
                    if (type === "dm") {
                        const contact = loadedContacts.find((c) => Number(c.userId) === Number(userId));
                        if (contact) openDirect(contact);
                    } else if (type === "group") {
                        const group = loadedGroups.find((g) => Number(g.id) === Number(id));
                        if (group) openGroup(group);
                    }
                } catch {

                }
            }
        };
        init();

        const unsubscribers = [
            addListener("message", (message) => {
                if (message.conversationId && message.createdAt) {
                    setLastMessageAt((previous) => ({
                        ...previous,
                        [message.conversationId]: message.createdAt,
                    }));
                }

                if (message.conversationId) {
                    setHidden((previous) => {
                        if (!previous[message.conversationId]) {
                            return previous;
                        }
                        const next = { ...previous };
                        delete next[message.conversationId];
                        return next;
                    });
                }

                const mine = message.senderId === currentUserIdRef.current;

                if (mine) {
                    if (message.conversationId === openConversationIdRef.current) {
                        shouldScrollToBottom.current = true;
                        setMessages((previous) => [...previous, message]);
                    }
                    return;
                }

                clearTyping(message.conversationId, message.senderId);

                const isDirect = message.conversationId && message.conversationId.startsWith("dm:");
                if (isDirect) {
                    const known =
                        contactsRef.current.some((c) => c.userId === message.senderId) ||
                        extraChatsRef.current.some((e) => e.userId === message.senderId);
                    if (!known && loadPartnersRef.current) {
                        loadPartnersRef.current();
                    }
                }

                if (message.conversationId === openConversationIdRef.current) {
                    shouldScrollToBottom.current = true;
                    setMessages((previous) => [...previous, message]);

                    const trulyViewing =
                        typeof document !== "undefined" &&
                        document.visibilityState === "visible" &&
                        windowFocusedRef.current;
                    if (trulyViewing) {
                        sendRead(message.conversationId);
                        clearConversation(message.conversationId);
                    } else {
                        sendDelivered(message.conversationId);
                        pendingReadRef.current = message.conversationId;
                    }
                } else {
                    sendDelivered(message.conversationId);
                }
            }),

            addListener("status", (update) => {

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
            }),

            addListener("typing", (event) => {
                if (event.typing) {
                    markTyping(event.conversationId, event.userId);
                } else {
                    clearTyping(event.conversationId, event.userId);
                }
            }),

            addListener("reaction", (update) => {
                setMessages((previous) =>
                    previous.map((m) =>
                        m.id === update.messageId
                            ? { ...m, reactions: update.reactions }
                            : m
                    )
                );
            }),

            addListener("deleted", (event) => {
                setMessages((previous) =>
                    previous.map((m) =>
                        m.id === event.messageId
                            ? { ...m, deleted: true, content: null, mediaUrl: null, reactions: [] }
                            : m
                    )
                );
            }),

            addListener("edited", (event) => {
                setMessages((previous) =>
                    previous.map((m) =>
                        m.id === event.messageId
                            ? { ...m, content: event.content, edited: true }
                            : m
                    )
                );
            }),

            addListener("groupAdded", (group) => {
                setGroups((previous) => {
                    const alreadyListed = previous.some((g) => g.id === group.id);
                    if (alreadyListed) return previous;
                    return [group, ...previous];
                });
            }),
        ];

        return () => {

            unsubscribers.forEach((off) => off());

            if (typingIdleTimerRef.current) clearTimeout(typingIdleTimerRef.current);
            Object.values(typingExpiryTimersRef.current).forEach(clearTimeout);
        };
    }, []);

    useEffect(() => {
        if (shouldScrollToBottom.current) {
            bottomRef.current?.scrollIntoView({ behavior: "auto" });
        }
    }, [messages]);

    useEffect(() => {
        const onFocus = () => {
            windowFocusedRef.current = true;
            if (pendingReadRef.current) {
                const convId = pendingReadRef.current;
                pendingReadRef.current = null;

                if (convId === openConversationIdRef.current) {
                    sendRead(convId);
                }
            }
        };
        const onBlur = () => {
            windowFocusedRef.current = false;
        };
        window.addEventListener("focus", onFocus);
        window.addEventListener("blur", onBlur);
        return () => {
            window.removeEventListener("focus", onFocus);
            window.removeEventListener("blur", onBlur);
        };
    }, []);

    const markReadIfFocused = (conversationId) => {
        if (windowFocusedRef.current) {
            sendRead(conversationId);
        } else {
            pendingReadRef.current = conversationId;
        }
    };

    useEffect(() => {
        if (menuFor === null && emojiPickerFor === null) return;
        const onDocClick = () => {
            setMenuFor(null);
            setEmojiPickerFor(null);
        };
        document.addEventListener("click", onDocClick);
        return () => document.removeEventListener("click", onDocClick);
    }, [menuFor, emojiPickerFor]);

    const markTyping = (conversationId, userId) => {
        const key = `${conversationId}:${userId}`;

        if (typingExpiryTimersRef.current[key]) {
            clearTimeout(typingExpiryTimersRef.current[key]);
        }
        typingExpiryTimersRef.current[key] = setTimeout(() => {
            clearTyping(conversationId, userId);
        }, TYPING_EXPIRE_MS);

        setTyping((previous) => {
            const forConvo = previous[conversationId] || {};
            if (forConvo[userId]) return previous;
            return { ...previous, [conversationId]: { ...forConvo, [userId]: true } };
        });
    };

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
            (response.data.data || []).forEach((p) => {
                map[p.userId] = p;
            });
            setPresence((previous) => ({ ...previous, ...map }));
        } catch {

        }
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

    const loadPartners = async () => {
        try {
            const response = await client.get("/api/conversations/partners");
            const partners = response.data.data || [];

            const contactIds = new Set(contactsRef.current.map((c) => c.userId));
            const extras = partners
                .filter((p) => !contactIds.has(p.userId))
                .map((p) => ({ userId: p.userId, name: p.phone || "Unknown", avatarUrl: p.avatarUrl }));

            setExtraChats(extras);
            loadPresence(extras.map((e) => e.userId));
        } catch {
        }
    };

    const loadSummaries = async () => {
        try {
            const response = await client.get("/api/conversations/summaries");
            setLastMessageAt(response.data.data || {});
        } catch {
        }
    };

    const loadHidden = async () => {
        try {
            const response = await client.get("/api/conversations/hidden");
            const map = {};
            for (const id of (response.data.data || [])) {
                map[id] = true;
            }
            setHidden(map);
        } catch {
        }
    };

    const handleDeleteConversation = async (target) => {
        if (!window.confirm("Delete this conversation? This removes it from your chat list.")) {
            return;
        }

        let conversationId;
        try {
            if (target.type === "group") {
                conversationId = groupConversationId(target.id);
                await client.delete(`/api/conversations/group/${target.id}`);
            } else {
                conversationId = dmConversationId(currentUserId, target.userId);
                await client.delete(`/api/conversations/${target.userId}`);
            }
        } catch {
            return;
        }

        setHidden((previous) => ({ ...previous, [conversationId]: true }));
        setHoveredChatId(null);
        setHeaderMenuOpen(false);

        const justDeletedOpenChat = openConversationIdRef.current === conversationId;
        if (justDeletedOpenChat) {
            setSelected(null);
            setMessages([]);
            openConversationIdRef.current = null;
            setOpenConversation(null);
        }
    };

    const handleSaveContact = async () => {
        if (selected?.type !== "dm") return;
        try {
            const response = await client.post(`/api/v1/contacts/user/${selected.userId}`);
            const saved = response.data.data;
            setHeaderMenuOpen(false);
            await loadContacts();
            loadPartners();
            setSelected((prev) => (prev ? { ...prev, name: saved.name } : prev));
        } catch {
        }
    };

    const handleBlock = async () => {
        if (selected?.type !== "dm") return;
        try {
            await blockUser(selected.userId);
            setIsBlocked(true);
            setHeaderMenuOpen(false);
        } catch {
            alert("Could not block this contact. Please try again.");
        }
    };

    const handleUnblock = async () => {
        if (selected?.type !== "dm") return;
        try {
            await unblockUser(selected.userId);
            setIsBlocked(false);
            setHeaderMenuOpen(false);
        } catch {
            alert("Could not unblock this contact. Please try again.");
        }
    };

    const openDirect = async (contact) => {
        const convId = dmConversationId(currentUserId, contact.userId);

        stopTypingNow(openConversationIdRef.current);
        setReplyingTo(null);
        setEditingMessage(null);
        setSelected({ type: "dm", userId: contact.userId, name: contact.name });
        openConversationIdRef.current = convId;
        setShowMembers(false);
        setHeaderMenuOpen(false);
        setMemberNames({});

        setIsBlocked(false);
        getBlockStatus(contact.userId)
            .then((r) => setIsBlocked(!!r.blocked))
            .catch(() => setIsBlocked(false));

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
        clearConversation(convId);

        try {
            const res = await client.get(`/api/presence/${contact.userId}`);
            setPresence((previous) => ({ ...previous, [contact.userId]: res.data.data }));
        } catch {

        }
    };

    const openGroup = async (group) => {
        const convId = groupConversationId(group.id);

        stopTypingNow(openConversationIdRef.current);
        setReplyingTo(null);
        setEditingMessage(null);
        setSelected({ type: "group", ...group });
        openConversationIdRef.current = convId;
        setShowMembers(false);

        try {
            const [history, members] = await Promise.all([
                getGroupHistory(group.id),
                getGroupMembers(group.id),
            ]);
            shouldScrollToBottom.current = true;
            setMessages(history.messages);
            setHasMore(history.hasMore);

            const names = {};
            members.forEach((member) => {
                names[member.userId] = member.name;
            });
            setMemberNames(names);

            loadPresence(members.map((member) => member.userId));
        } catch {
            setMessages([]);
            setHasMore(false);
            setMemberNames({});
        }

        markReadIfFocused(convId);
        clearConversation(convId);
    };

    const startReply = (message) => {
        setReplyingTo({
            id: message.id,
            senderId: message.senderId,
            senderName:
                message.senderId === currentUserId
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
        setTimeout(() => {
            node.style.background = original;
        }, 800);
    };

    const toggleReaction = async (messageId, emoji, mine) => {
        try {
            if (mine) {
                await unreactToMessage(messageId);
            } else {
                await reactToMessage(messageId, emoji);
            }
        } catch (error) {
            console.error("Reaction failed:", error);
        }

    };

    const loadOlderMessages = async () => {
        if (!hasMore || loadingMore || messages.length === 0) return;
        const container = scrollRef.current;
        const oldScrollHeight = container ? container.scrollHeight : 0;
        const oldScrollTop = container ? container.scrollTop : 0;
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
        } catch {

        } finally {
            setLoadingMore(false);
        }
    };

    const pickReaction = async (messageId, emoji) => {
        setEmojiPickerFor(null);
        try {
            await reactToMessage(messageId, emoji);
        } catch (error) {
            console.error("Reaction failed:", error);
        }
    };

    const handleDeleteForMe = async (messageId) => {
        setMenuFor(null);
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
        try {
            await deleteForMe(messageId);
        } catch (error) {
            console.error("Delete for me failed:", error);
        }
    };

    const handleDeleteForEveryone = async (messageId) => {
        setMenuFor(null);
        try {
            await deleteForEveryone(messageId);
        } catch (error) {
            console.error("Delete for everyone failed:", error);
            alert("Could not delete for everyone (too old, or not your message).");
        }
    };

    const canDeleteForEveryone = (message) => {
        if (message.senderId !== currentUserId) return false;
        if (message.deleted) return false;
        const ageMs = Date.now() - new Date(message.createdAt).getTime();
        return ageMs <= 60 * 60 * 1000;
    };

    const canEdit = (message) => {
        if (message.senderId !== currentUserId) return false;
        if (message.deleted) return false;
        if (message.type && message.type !== "TEXT") return false;
        const ageMs = Date.now() - new Date(message.createdAt).getTime();
        return ageMs <= 30 * 60 * 1000;
    };

    const startEdit = (message) => {
        setMenuFor(null);
        setReplyingTo(null);
        setEditingMessage({ id: message.id });
        setDraft(message.content || "");
    };

    const cancelEdit = () => {
        setEditingMessage(null);
        setDraft("");
    };

    const handleSend = () => {
        const text = draft.trim();
        if (!text || !selected) {
            return;
        }

        if (editingMessage) {
            const id = editingMessage.id;

            setMessages((prev) =>
                prev.map((m) => (m.id === id ? { ...m, content: text, edited: true } : m))
            );
            setEditingMessage(null);
            setDraft("");
            editMessage(id, text).catch((error) => {
                console.error("Edit failed:", error);
                alert("Could not edit (too old, or not your message).");
            });
            return;
        }

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

    const chatList = [...contacts, ...extraChats];

    const matchesSearch = (name) =>
        (name || "").toLowerCase().includes(chatSearch.trim().toLowerCase());

    const timeForConversation = (conversationId) => lastMessageAt[conversationId] || "";

    const byLastMessageDesc = (aTime, bTime, aName, bName) => {
        if (aTime && bTime) return bTime.localeCompare(aTime);
        if (aTime) return -1;
        if (bTime) return 1;
        return (aName || "").localeCompare(bName || "");
    };

    const isHidden = (conversationId) => Boolean(hidden[conversationId]);

    const visibleGroups = groups
        .filter((group) => matchesSearch(group.name))
        .filter((group) => !isHidden(groupConversationId(group.id)))
        .sort((a, b) => byLastMessageDesc(
            timeForConversation(groupConversationId(a.id)),
            timeForConversation(groupConversationId(b.id)),
            a.name, b.name,
        ));

    const visibleChats = chatList
        .filter((contact) => matchesSearch(contact.name))
        .filter((contact) => !isHidden(dmConversationId(currentUserId, contact.userId)))
        .sort((a, b) => byLastMessageDesc(
            timeForConversation(dmConversationId(currentUserId, a.userId)),
            timeForConversation(dmConversationId(currentUserId, b.userId)),
            a.name, b.name,
        ));

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

                <input
                    style={styles.search}
                    type="text"
                    value={chatSearch}
                    onChange={(event) => setChatSearch(event.target.value)}
                    placeholder="Search chats and groups…"
                />

                <p style={styles.sectionLabel}>Groups</p>
                {groups.length === 0 && <p style={styles.empty}>No groups yet.</p>}
                {visibleGroups.map((group) => {
                    const gConvId = groupConversationId(group.id);
                    const unread = unreadPerConversation[gConvId] || 0;
                    return (
                        <button
                            key={`g-${group.id}`}
                            style={{
                                ...styles.item,
                                ...(selected?.type === "group" && selected.id === group.id
                                    ? styles.itemActive
                                    : {}),
                            }}
                            onClick={() => openGroup(group)}
                            onMouseEnter={() => setHoveredChatId(gConvId)}
                            onMouseLeave={() => setHoveredChatId((id) => (id === gConvId ? null : id))}
                        >
                        <span style={styles.itemRow}>
                            <span style={styles.itemLeft}>
                                {group.avatarUrl ? (
                                    <img src={group.avatarUrl} alt="" style={styles.itemAvatar} />
                                ) : (
                                    <span style={styles.itemAvatarFallback}>#</span>
                                )}
                                <span style={styles.itemName}>{group.name}</span>
                            </span>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                                {unread > 0 && <span style={styles.unreadBadge}>{unread}</span>}
                                {hoveredChatId === gConvId && (
                                    <span
                                        style={styles.rowDelete}
                                        title="Delete chat"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteConversation({ type: "group", id: group.id });
                                        }}
                                    >
                                        🗑
                                    </span>
                                )}
                            </span>
                        </span>
                        </button>
                    );
                })}

                <p style={styles.sectionLabel}>Chats</p>
                {chatList.length === 0 && <p style={styles.empty}>No contacts yet.</p>}
                {visibleChats.map((contact) => {
                    const cConvId = dmConversationId(currentUserId, contact.userId);
                    const unread = unreadPerConversation[cConvId] || 0;
                    return (
                        <button
                            key={`c-${contact.userId}`}
                            style={{
                                ...styles.item,
                                ...(selected?.type === "dm" && selected.userId === contact.userId
                                    ? styles.itemActive
                                    : {}),
                            }}
                            onClick={() => openDirect(contact)}
                            onMouseEnter={() => setHoveredChatId(cConvId)}
                            onMouseLeave={() => setHoveredChatId((id) => (id === cConvId ? null : id))}
                        >
                        <span style={styles.itemRow}>
                            <span style={styles.itemLeft}>
                                {contact.avatarUrl ? (
                                    <img src={contact.avatarUrl} alt="" style={styles.itemAvatar} />
                                ) : (
                                    <span style={styles.itemAvatarFallback}>
                                        {(contact.name || "?").charAt(0).toUpperCase()}
                                    </span>
                                )}
                                <span style={styles.itemName}>{contact.name || "Unknown"}</span>
                            </span>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                                {unread > 0 && <span style={styles.unreadBadge}>{unread}</span>}
                                {hoveredChatId === cConvId && (
                                    <span
                                        style={styles.rowDelete}
                                        title="Delete chat"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteConversation({ type: "dm", userId: contact.userId });
                                        }}
                                    >
                                        🗑
                                    </span>
                                )}
                                <span
                                    style={{
                                        ...styles.dot,
                                        background: presence[contact.userId]?.online
                                            ? "#00d96a"
                                            : "#3b4a54",
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
                            <div style={styles.headerLeft}>
                                {selected.type === "dm" ? (
                                    (() => {
                                        const c = contacts.find((x) => x.userId === selected.userId);
                                        return c?.avatarUrl ? (
                                            <img src={c.avatarUrl} alt="" style={styles.headerAvatar} />
                                        ) : (
                                            <div style={styles.headerAvatarFallback}>
                                                {(selected.name || "?").charAt(0).toUpperCase()}
                                            </div>
                                        );
                                    })()
                                ) : (
                                    selected.avatarUrl ? (
                                        <img src={selected.avatarUrl} alt="" style={styles.headerAvatar} />
                                    ) : (
                                        <div style={styles.headerAvatarFallback}>#</div>
                                    )
                                )}
                                <div style={styles.headerInfo}>
                                    <span
                                        style={{
                                            ...styles.headerName,
                                            ...(selected.type === "dm" ? styles.clickableName : {}),
                                        }}
                                        onClick={() => {
                                            if (selected.type === "dm") {
                                                navigate(`/users/${selected.userId}/profile`);
                                            }
                                        }}
                                    >
                                        {selected.name}
                                    </span>
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
                            </div>
                            {selected.type === "group" && (
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <button style={styles.infoBtn} onClick={() => setShowMembers((v) => !v)}>
                                        Members
                                    </button>
                                    <div style={{ position: "relative" }}>
                                        <button
                                            style={styles.infoBtn}
                                            onClick={() => setHeaderMenuOpen((v) => !v)}
                                            aria-label="Chat options"
                                        >
                                            ⋮
                                        </button>
                                        {headerMenuOpen && (
                                            <div style={styles.headerMenu}>
                                                <button
                                                    style={{ ...styles.headerMenuItem, color: "#f15c6d" }}
                                                    onClick={() => handleDeleteConversation({ type: "group", id: selected.id })}
                                                >
                                                    Delete conversation
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                            {selected.type === "dm" && (
                                <div style={{ position: "relative" }}>
                                    <button
                                        style={styles.infoBtn}
                                        onClick={() => setHeaderMenuOpen((v) => !v)}
                                        aria-label="Chat options"
                                    >
                                        ⋮
                                    </button>
                                    {headerMenuOpen && (
                                        <div style={styles.headerMenu}>
                                            {!contacts.some((c) => c.userId === selected.userId) && (
                                                <button
                                                    style={styles.headerMenuItem}
                                                    onClick={handleSaveContact}
                                                >
                                                    Save contact
                                                </button>
                                            )}
                                            {isBlocked ? (
                                                <button
                                                    style={styles.headerMenuItem}
                                                    onClick={handleUnblock}
                                                >
                                                    Unblock
                                                </button>
                                            ) : (
                                                <button
                                                    style={{ ...styles.headerMenuItem, color: "#f15c6d" }}
                                                    onClick={handleBlock}
                                                >
                                                    Block
                                                </button>
                                            )}
                                            <button
                                                style={{ ...styles.headerMenuItem, color: "#f15c6d" }}
                                                onClick={() => handleDeleteConversation({ type: "dm", userId: selected.userId })}
                                            >
                                                Delete conversation
                                            </button>
                                        </div>
                                    )}
                                </div>
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
                                <div style={styles.loadingMore}>↑ Scroll up for older messages</div>
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

                                            {}
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

                                            {message.deleted ? (
                                                <span style={styles.deletedText}>🚫 This message was deleted</span>
                                            ) : (
                                                <>
                                                    <QuotedMessage
                                                        message={message}
                                                        currentUserId={currentUserId}
                                                        onJump={jumpToMessage}
                                                    />

                                                    <MessageContent message={message} onImageClick={setLightboxUrl} />
                                                </>
                                            )}

                                            <span style={styles.meta}>
                                                {message.edited && !message.deleted && (
                                                    <span style={styles.editedLabel}>edited</span>
                                                )}
                                                <span style={styles.time}>
                                                    {formatTime(message.createdAt)}
                                                </span>
                                                {mine && !message.deleted && <Ticks message={message} />}
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
                                                <div
                                                    style={styles.actionMenu}
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    {!message.deleted && (
                                                        <>
                                                            <button
                                                                style={styles.actionMenuItem}
                                                                onClick={() => {
                                                                    setMenuFor(null);
                                                                    setEmojiPickerFor(message.id);
                                                                }}
                                                            >
                                                                React
                                                            </button>
                                                            <button
                                                                style={styles.actionMenuItem}
                                                                onClick={() => {
                                                                    setMenuFor(null);
                                                                    startReply(message);
                                                                }}
                                                            >
                                                                Reply
                                                            </button>
                                                            {canEdit(message) && (
                                                                <button
                                                                    style={styles.actionMenuItem}
                                                                    onClick={() => startEdit(message)}
                                                                >
                                                                    Edit
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
                                                    <button
                                                        style={styles.actionMenuItem}
                                                        onClick={() => handleDeleteForMe(message.id)}
                                                    >
                                                        Delete for me
                                                    </button>
                                                    {canDeleteForEveryone(message) && (
                                                        <button
                                                            style={styles.actionMenuItemDanger}
                                                            onClick={() => handleDeleteForEveryone(message.id)}
                                                        >
                                                            Delete for everyone
                                                        </button>
                                                    )}
                                                </div>
                                            )}

                                            {pickerOpen && (
                                                <div
                                                    style={{
                                                        ...styles.emojiPopover,
                                                        ...(mine ? styles.emojiPopoverMine : styles.emojiPopoverTheirs),
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                >
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
                                            onToggle={(emoji, isMine) =>
                                                toggleReaction(message.id, emoji, isMine)
                                            }
                                            alignRight={mine}
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
                                            {replyingTo.content
                                                ? replyingTo.content
                                                : mediaPreviewLabel(replyingTo.type)}
                                        </div>
                                    </div>
                                    <button
                                        style={styles.replyBarClose}
                                        onClick={cancelReply}
                                        title="Cancel reply"
                                    >
                                        ✕
                                    </button>
                                </div>
                            )}

                            {editingMessage && (
                                <div style={styles.replyBar}>
                                    <div style={styles.replyBarBody}>
                                        <div style={styles.replyBarAuthor}>Editing message</div>
                                        <div style={styles.replyBarText}>Make your changes and press Save</div>
                                    </div>
                                    <button
                                        style={styles.replyBarClose}
                                        onClick={cancelEdit}
                                        title="Cancel edit"
                                    >
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

                                {!editingMessage && (
                                    <button
                                        style={styles.attachButton}
                                        onClick={() => fileInputRef.current.click()}
                                        disabled={isUploading}
                                        title="Attach a file"
                                    >
                                        📎
                                    </button>
                                )}

                                <input
                                    style={styles.input}
                                    value={isUploading ? "Uploading..." : draft}
                                    onChange={(e) => {
                                        setDraft(e.target.value);
                                        if (!editingMessage) handleTypingActivity();
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") handleSend();
                                        if (e.key === "Escape" && editingMessage) cancelEdit();
                                    }}
                                    placeholder={editingMessage ? "Edit your message" : "Type a message"}
                                    disabled={isUploading}
                                />

                                <button
                                    style={styles.sendButton}
                                    onClick={handleSend}
                                    disabled={isUploading}
                                >
                                    {editingMessage ? "Save" : "Send"}
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
                    onUpdated={(updatedGroup) => {
                        setGroups((prev) =>
                            prev.map((g) => (g.id === updatedGroup.id ? { ...g, ...updatedGroup } : g))
                        );
                        setSelected((prev) =>
                            prev && prev.type === "group" && prev.id === updatedGroup.id
                                ? { ...prev, ...updatedGroup }
                                : prev
                        );
                    }}
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

            <NotificationToast
                notification={activeToast}
                onClose={() => setActiveToast(null)}
                onClick={(conversationId) => {
                    if (conversationId?.startsWith("dm:")) {
                        const parts = conversationId.split(":");
                        const otherId = Number(parts[1]) === currentUserId ? Number(parts[2]) : Number(parts[1]);
                        const contact = contacts.find((c) => c.userId === otherId);
                        if (contact) openDirect(contact);
                    } else if (conversationId?.startsWith("group:")) {
                        const groupId = Number(conversationId.split(":")[1]);
                        const group = groups.find((g) => g.id === groupId);
                        if (group) openGroup(group);
                    }
                    setActiveToast(null);
                }}
            />
        </div>
    );
}

const styles = {
    page: { display: "flex", height: "100vh", background: "var(--c-bg)", color: "var(--c-text)" },
    sidebar: {
        width: "280px",
        borderRight: "1px solid var(--c-surface)",
        overflowY: "auto",
        padding: "12px",
        background: "var(--c-panel)",
    },
    sidebarHeader: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        margin: "4px 8px 12px",
    },
    sidebarTitle: { fontSize: "18px", margin: 0, color: "var(--c-text)" },
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
        color: "var(--c-muted)",
        margin: "14px 8px 6px",
    },
    empty: { fontSize: "14px", color: "var(--c-muted)", padding: "0 8px" },
    search: {
        margin: "4px 12px 8px",
        padding: "9px 12px",
        fontSize: "13.5px",
        background: "var(--c-bg)",
        border: "1px solid var(--c-border2)",
        borderRadius: "9px",
        color: "var(--c-text)",
        outline: "none",
    },
    rowDelete: {
        cursor: "pointer",
        fontSize: "14px",
        lineHeight: 1,
        opacity: 0.85,
    },
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
        color: "var(--c-text)",
    },
    itemActive: { background: "var(--c-border2)" },
    itemRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" },
    itemLeft: { display: "flex", alignItems: "center", gap: "10px", minWidth: 0 },
    itemName: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
    itemAvatar: { width: "34px", height: "34px", borderRadius: "50%", objectFit: "cover", flex: "0 0 auto" },
    itemAvatarFallback: {
        width: "34px",
        height: "34px",
        borderRadius: "50%",
        background: "var(--c-border2)",
        color: "var(--c-text)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "14px",
        fontWeight: 600,
        flex: "0 0 auto",
    },
    dot: {
        width: "9px",
        height: "9px",
        borderRadius: "50%",
        flex: "0 0 auto",
    },
    unreadBadge: {
        minWidth: "18px",
        height: "18px",
        padding: "0 5px",
        borderRadius: "9px",
        background: "#00a884",
        color: "#fff",
        fontSize: "11px",
        fontWeight: 700,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
    },
    chat: { flex: 1, display: "flex", flexDirection: "column", background: "var(--c-bg)" },
    placeholder: {
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--c-muted)",
    },
    chatHeader: {
        padding: "10px 16px",
        borderBottom: "1px solid var(--c-surface)",
        color: "var(--c-text)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
    },
    headerInfo: { display: "flex", flexDirection: "column" },
    headerLeft: { display: "flex", alignItems: "center", gap: "10px" },
    headerAvatar: { width: "38px", height: "38px", borderRadius: "50%", objectFit: "cover", flex: "0 0 auto" },
    headerAvatarFallback: { width: "38px", height: "38px", borderRadius: "50%", background: "var(--c-border2)", color: "var(--c-text)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: 600, flex: "0 0 auto" },
    headerName: { fontWeight: 600, fontSize: "15px" },
    clickableName: { cursor: "pointer" },
    headerMenu: {
        position: "absolute",
        top: "36px",
        right: "0",
        background: "var(--c-surface2)",
        border: "1px solid var(--c-border2)",
        borderRadius: "8px",
        boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
        zIndex: 30,
        minWidth: "140px",
        overflow: "hidden",
    },
    headerMenuItem: {
        display: "block",
        width: "100%",
        textAlign: "left",
        padding: "10px 14px",
        background: "none",
        border: "none",
        color: "var(--c-text)",
        fontSize: "14px",
        cursor: "pointer",
    },
    presenceLine: { fontSize: "12px", color: "var(--c-muted)", marginTop: "1px", minHeight: "14px" },
    infoBtn: {
        fontSize: "13px",
        padding: "6px 12px",
        border: "1px solid var(--c-border2)",
        borderRadius: "6px",
        background: "transparent",
        color: "var(--c-text)",
        cursor: "pointer",
    },
    messages: {
        flex: 1,
        overflowY: "auto",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
    },
    loadingMore: { textAlign: "center", fontSize: "12px", color: "var(--c-muted)", padding: "8px 0", flexShrink: 0 },
    row: {
        display: "flex",
        flexDirection: "column",
        maxWidth: "65%",
    },
    bubble: {
        position: "relative",
        maxWidth: "100%",
        padding: "6px 26px 5px 12px",
        borderRadius: "12px",
        fontSize: "14px",
        lineHeight: 1.4,
        display: "flex",
        flexDirection: "column",
    },
    bubbleMine: { background: "var(--c-outgoing)", color: "var(--c-text)" },
    bubbleTheirs: { background: "var(--c-incoming)", color: "var(--c-text)" },
    sender: { fontSize: "12px", color: "#53bdeb", marginBottom: "2px", fontWeight: 600 },
    statusPreview: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: "rgba(0,0,0,0.2)",
        borderLeft: "3px solid #00a884",
        borderRadius: "4px",
        padding: "6px 8px",
        marginBottom: 6,
        overflow: "hidden",
    },
    previewImg: {
        width: 40, height: 40,
        borderRadius: 4,
        objectFit: "cover",
        flexShrink: 0,
    },
    previewBody: {
        display: "flex", flexDirection: "column", gap: 2, minWidth: 0,
    },
    previewAuthor: {
        fontSize: 11, color: "#00a884", fontWeight: 600,
    },
    previewText: {
        fontSize: 12, color: "var(--c-tick2)",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
    },
    text: { whiteSpace: "pre-wrap", wordBreak: "break-word", textAlign: "left" },
    meta: {
        alignSelf: "flex-end",
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        marginTop: "2px",
        whiteSpace: "nowrap",
    },
    time: { fontSize: "11px", color: "var(--c-tick)" },
    editedLabel: { fontSize: "10.5px", color: "var(--c-tick)", fontStyle: "italic", marginRight: "2px" },


    chevron: {
        position: "absolute",
        top: "3px",
        right: "3px",
        border: "none",
        borderRadius: "50%",
        width: "18px",
        height: "18px",
        lineHeight: "14px",
        fontSize: "13px",
        cursor: "pointer",
        color: "var(--c-text3)",
        background: "rgba(0,0,0,0.28)",
        padding: 0,
    },
    chevronMine: {},
    chevronTheirs: {},

    actionMenu: {
        position: "absolute",
        top: "24px",
        left: "0",
        zIndex: 20,
        display: "flex",
        flexDirection: "column",
        minWidth: "120px",
        background: "var(--c-surface2)",
        border: "1px solid var(--c-border2)",
        borderRadius: "8px",
        boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
        overflow: "hidden",
    },
    actionMenuItem: {
        border: "none",
        background: "transparent",
        color: "var(--c-text)",
        textAlign: "left",
        padding: "8px 14px",
        fontSize: "14px",
        cursor: "pointer",
    },
    actionMenuItemDanger: {
        border: "none",
        background: "transparent",
        color: "#f15c6d",
        textAlign: "left",
        padding: "8px 14px",
        fontSize: "14px",
        cursor: "pointer",
    },
    deletedText: { fontStyle: "italic", color: "var(--c-muted)", fontSize: "13.5px" },

    pillRow: { display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "3px", alignSelf: "stretch" },
    pill: {
        display: "inline-flex",
        alignItems: "center",
        gap: "3px",
        border: "1px solid var(--c-border2)",
        background: "var(--c-surface5)",
        borderRadius: "11px",
        padding: "1px 7px",
        fontSize: "12px",
        cursor: "pointer",
        color: "var(--c-text)",
        lineHeight: 1.6,
    },
    pillMine: { border: "1px solid #00a884", background: "#0c3a30" },
    pillCount: { fontSize: "11px", color: "var(--c-text2)" },

    emojiPopover: {
        position: "absolute",
        zIndex: 20,
        display: "flex",
        gap: "2px",
        padding: "4px 6px",
        background: "var(--c-surface2)",
        border: "1px solid var(--c-border2)",
        borderRadius: "22px",
        boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
        whiteSpace: "nowrap",
    },
    emojiPopoverMine: { right: 0 },
    emojiPopoverTheirs: { left: 0 },
    emojiChoice: {
        border: "none",
        background: "transparent",
        cursor: "pointer",
        fontSize: "20px",
        lineHeight: 1,
        padding: "2px 4px",
        borderRadius: "6px",
    },

    quoteBlock: {
        borderLeft: "3px solid #53bdeb",
        background: "rgba(255,255,255,0.06)",
        borderRadius: "4px",
        padding: "4px 8px",
        marginBottom: "4px",
        cursor: "pointer",
        maxWidth: "100%",
    },
    quoteAuthor: { fontSize: "12px", fontWeight: 600, color: "#53bdeb", marginBottom: "1px" },
    quoteText: {
        fontSize: "12.5px",
        color: "var(--c-text2)",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        maxWidth: "260px",
    },
    quoteDeleted: { fontStyle: "italic", color: "var(--c-muted)" },

    composerWrap: { borderTop: "1px solid var(--c-surface)", background: "var(--c-panel)" },
    replyBar: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "8px",
        padding: "8px 12px 0",
    },
    replyBarBody: {
        flex: 1,
        borderLeft: "3px solid #00a884",
        background: "var(--c-surface5)",
        borderRadius: "4px",
        padding: "4px 8px",
        overflow: "hidden",
    },
    replyBarAuthor: { fontSize: "12px", fontWeight: 600, color: "#00a884" },
    replyBarText: {
        fontSize: "12.5px",
        color: "var(--c-text2)",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },
    replyBarClose: {
        border: "none",
        background: "transparent",
        color: "var(--c-muted)",
        cursor: "pointer",
        fontSize: "16px",
        lineHeight: 1,
        padding: "4px",
    },

    mediaImage: {
        maxWidth: "240px",
        maxHeight: "240px",
        borderRadius: "8px",
        cursor: "pointer",
        display: "block",
        marginBottom: "4px",
    },
    mediaVideo: { maxWidth: "280px", borderRadius: "8px", display: "block", marginBottom: "4px" },
    mediaAudio: { maxWidth: "260px", display: "block", marginBottom: "4px" },
    fileLink: { color: "#53bdeb", textDecoration: "none", display: "block", marginBottom: "4px" },
    caption: { margin: "4px 0 0", fontSize: "13px" },

    composer: {
        display: "flex",
        gap: "8px",
        padding: "12px",
    },
    attachButton: {
        padding: "10px 12px",
        border: "none",
        borderRadius: "6px",
        background: "var(--c-border2)",
        color: "var(--c-text)",
        cursor: "pointer",
        fontSize: "16px",
    },
    input: {
        flex: 1,
        padding: "10px",
        fontSize: "14px",
        border: "1px solid var(--c-border2)",
        borderRadius: "6px",
        background: "var(--c-border2)",
        color: "var(--c-text)",
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

    lightboxOverlay: {
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
    },
    lightboxImg: { maxWidth: "90vw", maxHeight: "90vh", borderRadius: "8px", objectFit: "contain" },
    lightboxClose: {
        position: "absolute",
        top: "16px",
        right: "20px",
        background: "none",
        border: "none",
        color: "#fff",
        fontSize: "28px",
        cursor: "pointer",
        lineHeight: 1,
    },
};
