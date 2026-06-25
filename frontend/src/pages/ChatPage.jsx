import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import { useSocket } from "../context/SocketContext";
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

// Full-screen image preview, opened by clicking an image bubble.
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

// Renders the body of a message bubble.
// For TEXT: shows the text. For IMAGE/VIDEO/AUDIO/FILE: the matching media element.
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

    // Default: plain text
    return <span style={styles.text}>{content}</span>;
}

// A one-line preview of a media message, used inside the reply quote block
// when the original has no caption (e.g. "📷 Photo").
function mediaPreviewLabel(type) {
    if (type === "IMAGE") return "📷 Photo";
    if (type === "VIDEO") return "🎥 Video";
    if (type === "AUDIO") return "🎵 Audio";
    if (type === "FILE") return "📎 File";
    return "";
}

// The quote block shown INSIDE a bubble when the message is a reply.
// Reads the flat replyTo* fields the backend attaches. Clicking it asks the
// parent to scroll to / highlight the original (if it's still loaded).
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

// A small quick-pick set for the reaction popover. "Any emoji" is supported by
// the backend (it stores a plain string); swap this for a full picker library
// later if you want the whole keyboard.
const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

// The reaction pills shown under a bubble. Groups the flat reaction list by
// emoji into { emoji, count, mine }, and lets you toggle your own off by
// tapping a pill you're part of.
function ReactionPills({ reactions, currentUserId, onToggle }) {
    if (!reactions || reactions.length === 0) return null;

    // emoji -> { count, mine }
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
    const { clearConversation, unreadPerConversation, refreshUnreadCounts } = useNotification();
    const { presence, setPresence, addListener, setOpenConversation } = useSocket();

    const [contacts, setContacts] = useState([]);
    const [groups, setGroups] = useState([]);

    // The open conversation: either { type: "dm", userId, name }
    // or a group object { type: "group", id, name, myRole, ... }. null = nothing open.
    const [selected, setSelected] = useState(null);

    const [messages, setMessages] = useState([]);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [draft, setDraft] = useState("");

    // When set, the composer is in EDIT mode for this message { id }.
    const [editingMessage, setEditingMessage] = useState(null);

    // userId -> name for the open group, so we can label who sent each message.
    const [memberNames, setMemberNames] = useState({});

    // userId -> { userId, online, lastSeen } presence for contacts / open chat.
    // userId -> { userId, online, lastSeen } presence comes from SocketContext now.

    // conversationId -> { [userId]: true } for people currently typing in that
    // chat. A per-user timer (in a ref) auto-clears the entry if no "stopped" arrives.
    const [typing, setTyping] = useState({});

    // Bumped once a minute purely to re-render relative "last seen ..." labels.
    const [, setNowTick] = useState(0);

    const [showNewGroup, setShowNewGroup] = useState(false);
    const [showMembers, setShowMembers] = useState(false);

    // Media: upload-in-progress flag and the currently-open lightbox image.
    const [isUploading, setIsUploading] = useState(false);
    const [lightboxUrl, setLightboxUrl] = useState(null);

    // The message the composer is currently replying to (null = not replying).
    // Holds a small snapshot { id, senderId, senderName, content, type } so the
    // quote bar can render without re-finding the message.
    const [replyingTo, setReplyingTo] = useState(null);

    // messageId whose emoji quick-picker is currently open (null = none open).
    const [emojiPickerFor, setEmojiPickerFor] = useState(null);

    // messageId currently hovered (shows the ⌄ chevron) and the message whose
    // React/Reply menu is open (null = none).
    const [hoveredMessageId, setHoveredMessageId] = useState(null);
    const [menuFor, setMenuFor] = useState(null);

    const openConversationIdRef = useRef(null);
    const bottomRef = useRef(null);
    const scrollRef = useRef(null);
    // Gate auto-scroll: true on open/new message, false when prepending older.
    const shouldScrollToBottom = useRef(true);
    // Always-fresh copy of my id, so the WebSocket callback (created once at
    // mount) never reads a stale/undefined value.
    const currentUserIdRef = useRef(null);

    // Whether THIS browser window is focused right now. We only send read
    // receipts when focused — having the chat open in a background window
    // (e.g. two windows side by side while testing) must NOT mark messages read.
    const windowFocusedRef = useRef(
        typeof document === "undefined" ? true : document.hasFocus()
    );
    // If a message arrives (or a chat is opened) while this window is NOT
    // focused, we remember the conversation here and send the read receipt the
    // moment the window regains focus — never before.
    const pendingReadRef = useRef(null);

    // Hidden file input for the attachment (paperclip) button.
    const fileInputRef = useRef(null);

    // id -> bubble DOM node, so tapping a reply quote can scroll to the original.
    const messageRefs = useRef({});

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

    // Persist the selected chat so a reload restores it. Also tell the socket
    // provider which conversation is open, so it can suppress the toast for it.
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

    // Re-render every minute so "last seen ..." stays current (e.g. rolls over
    // to "yesterday") even if no new presence update arrives.
    useEffect(() => {
        const timer = setInterval(() => setNowTick((n) => n + 1), 60000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const init = async () => {
            const [loadedContacts, loadedGroups] = await Promise.all([loadContacts(), loadGroups()]);

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
                    /* ignore bad data */
                }
            }
        };
        init();

        // Reconcile unread badges with the backend whenever the chat page mounts
        // (e.g. navigating here from Home), so the count is correct immediately.
        refreshUnreadCounts();

        // The socket itself lives in SocketContext (app-wide). Here we just
        // register the chat-page-specific listeners and clean them up on unmount.
        const unsubscribers = [
            addListener("message", (message) => {
                const mine = message.senderId === currentUserIdRef.current;

                // My OWN echoed message: just show it, never acknowledge it.
                if (mine) {
                    if (message.conversationId === openConversationIdRef.current) {
                        shouldScrollToBottom.current = true;
                        setMessages((previous) => [...previous, message]);
                    }
                    return;
                }

                // Someone else sent this. A new message means they're no longer
                // "typing" — clear any indicator we were showing for them.
                clearTyping(message.conversationId, message.senderId);

                if (message.conversationId === openConversationIdRef.current) {
                    shouldScrollToBottom.current = true;
                    setMessages((previous) => [...previous, message]);
                    // Only mark READ if the user is genuinely viewing this chat:
                    // the window is visible AND focused. Otherwise just delivered,
                    // and defer the read until they actually come back to it.
                    const trulyViewing =
                        typeof document !== "undefined" &&
                        document.visibilityState === "visible" &&
                        windowFocusedRef.current;
                    if (trulyViewing) {
                        sendRead(message.conversationId);
                        clearConversation(message.conversationId); // keep badge at 0 while viewing
                    } else {
                        sendDelivered(message.conversationId);
                        pendingReadRef.current = message.conversationId;
                    }
                } else {
                    sendDelivered(message.conversationId); // arrived, chat not open
                }
            }),

            addListener("status", (update) => {
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
        ];

        return () => {
            // Remove our listeners (the socket itself stays alive in the provider).
            unsubscribers.forEach((off) => off());
            // Leaving the chat page: tell the provider no conversation is open,
            // so it resumes sending delivery receipts and showing toasts for
            // incoming messages on other pages.
            setOpenConversation(null);
            // Clear any pending typing timers so they don't fire after unmount.
            if (typingIdleTimerRef.current) clearTimeout(typingIdleTimerRef.current);
            Object.values(typingExpiryTimersRef.current).forEach(clearTimeout);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (shouldScrollToBottom.current) {
            bottomRef.current?.scrollIntoView({ behavior: "auto" });
        }
    }, [messages]);

    // Track whether this window is focused. On regaining focus, if the open
    // chat had a message arrive while we were away, send its read receipt now.
    useEffect(() => {
        const onFocus = () => {
            windowFocusedRef.current = true;
            if (pendingReadRef.current) {
                const convId = pendingReadRef.current;
                pendingReadRef.current = null;
                // Only mark read if that conversation is still the open one.
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

    // Send a read receipt only if this window is focused; otherwise defer it
    // until focus returns (WhatsApp behaviour — an open-but-background chat
    // does not mark messages read).
    const markReadIfFocused = (conversationId) => {
        if (windowFocusedRef.current) {
            sendRead(conversationId);
        } else {
            pendingReadRef.current = conversationId;
        }
    };

    // Close the React/Reply menu and emoji picker on any click outside of them.
    // The chevron, menu, and picker stop propagation, so their own clicks don't
    // trigger this; a click anywhere else dismisses them.
    useEffect(() => {
        if (menuFor === null && emojiPickerFor === null) return;
        const onDocClick = () => {
            setMenuFor(null);
            setEmojiPickerFor(null);
        };
        document.addEventListener("click", onDocClick);
        return () => document.removeEventListener("click", onDocClick);
    }, [menuFor, emojiPickerFor]);

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
            return mapped;
        } catch {
            return [];
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
            const data = await listGroups();
            setGroups(data);
            return data;
        } catch {
            return [];
        }
    };

    const openDirect = async (contact) => {
        const convId = dmConversationId(currentUserId, contact.userId);
        // Leaving the previous chat: stop any typing signal there.
        stopTypingNow(openConversationIdRef.current);
        setReplyingTo(null); // don't carry a reply draft into another chat
        setEditingMessage(null);
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

        // Opening a chat means I've read everything in it.
        markReadIfFocused(convId);
        clearConversation(convId); // zero its unread badge instantly
        // Reconcile to the backend truth shortly after (read receipts have flushed).
        setTimeout(() => refreshUnreadCounts(), 600);

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
        setReplyingTo(null); // don't carry a reply draft into another chat
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

            // Presence for the members, so the header can show "N online".
            loadPresence(members.map((member) => member.userId));
        } catch {
            setMessages([]);
            setHasMore(false);
            setMemberNames({});
        }

        // Opening the group means I've read everything in it.
        markReadIfFocused(convId);
        clearConversation(convId); // zero its unread badge instantly
        // Reconcile to the backend truth shortly after (read receipts have flushed).
        setTimeout(() => refreshUnreadCounts(), 600);
    };

    // ---- replies ----

    // Start replying to a message: capture a small snapshot for the quote bar.
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

    // Scroll to and briefly highlight the original message a reply points at.
    const jumpToMessage = (messageId) => {
        const node = messageRefs.current[messageId];
        if (!node) return; // original not loaded (e.g. far up history)
        node.scrollIntoView({ behavior: "smooth", block: "center" });
        node.style.transition = "background 0.4s";
        const original = node.style.background;
        node.style.background = "#3a4a3f";
        setTimeout(() => {
            node.style.background = original;
        }, 800);
    };

    // ---- reactions ----

    // Tapping an existing pill: remove mine if it's mine, else react with it.
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
        // The updated list arrives via the /user/queue/reactions broadcast.
    };

    // Picking from the quick-picker popover.
    // Load older messages on scroll-up. Saves scrollHeight before prepending,
    // then restores the offset after the DOM updates so the view doesn't jump.
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
            /* silent */
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

    // ---- delete ----

    // Delete for me: hide locally right away, then tell the server.
    const handleDeleteForMe = async (messageId) => {
        setMenuFor(null);
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
        try {
            await deleteForMe(messageId);
        } catch (error) {
            console.error("Delete for me failed:", error);
        }
    };

    // Delete for everyone: the server broadcasts back, which flips the bubble to
    // "deleted" for all (including me) via the onMessageDeleted handler.
    const handleDeleteForEveryone = async (messageId) => {
        setMenuFor(null);
        try {
            await deleteForEveryone(messageId);
        } catch (error) {
            console.error("Delete for everyone failed:", error);
            alert("Could not delete for everyone (too old, or not your message).");
        }
    };

    // Can the current user still delete THIS message for everyone?
    // Sender only, within 1 hour, and not already deleted.
    const canDeleteForEveryone = (message) => {
        if (message.senderId !== currentUserId) return false;
        if (message.deleted) return false;
        const ageMs = Date.now() - new Date(message.createdAt).getTime();
        return ageMs <= 60 * 60 * 1000; // 1 hour
    };

    // Can the current user edit THIS message? Sender, own TEXT message, within
    // 30 minutes. Read status does not matter (WhatsApp-style).
    const canEdit = (message) => {
        if (message.senderId !== currentUserId) return false;
        if (message.deleted) return false;
        if (message.type && message.type !== "TEXT") return false;
        const ageMs = Date.now() - new Date(message.createdAt).getTime();
        return ageMs <= 30 * 60 * 1000; // 30 minutes
    };

    // Start editing: put the composer into edit mode, pre-filled with the text.
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

        // Edit mode: save the edit instead of sending a new message.
        if (editingMessage) {
            const id = editingMessage.id;
            // optimistic update; the broadcast will confirm
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
        setReplyingTo(null); // reply consumed
        // Sending a message means I've stopped typing.
        stopTypingNow(openConversationIdRef.current);
    };

    // Called when the user picks a file from the file picker.
    const handleFileSelected = async (event) => {
        const file = event.target.files[0];
        if (!file || !selected) return;

        // Reset so picking the same file again still fires onChange.
        event.target.value = "";

        const messageType = getMessageType(file); // "IMAGE", "VIDEO", "AUDIO", or "FILE"

        setIsUploading(true);
        try {
            const mediaUrl = await uploadMedia(file); // upload to server, get back URL

            const replyToId = replyingTo ? replyingTo.id : null;

            if (selected.type === "dm") {
                sendMessage(selected.userId, "", messageType, mediaUrl, replyToId);
            } else {
                sendGroupMessage(selected.id, "", messageType, mediaUrl, replyToId);
            }
            setReplyingTo(null); // reply consumed
        } catch (error) {
            console.error("Media upload failed:", error);
            alert("Upload failed. Please try again.");
        } finally {
            setIsUploading(false);
        }

        // Attaching a file means I've stopped typing.
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
                {groups.map((group) => {
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
                        >
                        <span style={styles.itemRow}>
                            <span># {group.name}</span>
                            {unread > 0 && <span style={styles.unreadBadge}>{unread}</span>}
                        </span>
                        </button>
                    );
                })}

                <p style={styles.sectionLabel}>Chats</p>
                {contacts.length === 0 && <p style={styles.empty}>No contacts yet.</p>}
                {contacts.map((contact) => {
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
                        >
                        <span style={styles.itemRow}>
                            <span>{contact.name || "Unknown"}</span>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                                {unread > 0 && <span style={styles.unreadBadge}>{unread}</span>}
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
                                    <div style={styles.headerAvatarFallback}>#</div>
                                )}
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

                                            {/* Status reply preview — shown above the reply text */}
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
                                                    {/* reply quote, only on reply messages */}
                                                    <QuotedMessage
                                                        message={message}
                                                        currentUserId={currentUserId}
                                                        onJump={jumpToMessage}
                                                    />

                                                    {/* renders text, image, video, audio, or file */}
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

                                            {/* hover chevron: opens the React / Reply menu */}
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

                                            {/* the little React / Reply menu */}
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

                                            {/* emoji quick-picker, floating ABOVE the bubble */}
                                            {pickerOpen && (
                                                <div
                                                    style={styles.emojiPopover}
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

                                        {/* reaction pills sit UNDER the bubble */}
                                        <ReactionPills
                                            reactions={message.reactions}
                                            currentUserId={currentUserId}
                                            onToggle={(emoji, isMine) =>
                                                toggleReaction(message.id, emoji, isMine)
                                            }
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
                                {/* hidden file input */}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    style={{ display: "none" }}
                                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
                                    onChange={handleFileSelected}
                                />

                                {/* paperclip / attach button — hidden while editing */}
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

            {/* Toast is now rendered app-wide by SocketProvider */}

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
    headerLeft: { display: "flex", alignItems: "center", gap: "10px" },
    headerAvatar: { width: "38px", height: "38px", borderRadius: "50%", objectFit: "cover", flex: "0 0 auto" },
    headerAvatarFallback: { width: "38px", height: "38px", borderRadius: "50%", background: "#2a3942", color: "#e9edef", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: 600, flex: "0 0 auto" },
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
        gap: "10px",
    },
    loadingMore: { textAlign: "center", fontSize: "12px", color: "#8696a0", padding: "8px 0", flexShrink: 0 },
    // one message = a column: [bubble] then [pills]. The row hugs its content
    // and the JSX sets alignItems (flex-end for mine, flex-start for theirs).
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
    bubbleMine: { background: "#005c4b", color: "#e9edef" },
    bubbleTheirs: { background: "#202c33", color: "#e9edef" },
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
        fontSize: 12, color: "#a8c5bd",
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
    time: { fontSize: "11px", color: "#9fc1b8" },
    editedLabel: { fontSize: "10.5px", color: "#9fc1b8", fontStyle: "italic", marginRight: "2px" },

    // hover chevron at the bubble's top corner
    // hover chevron in the bubble's top-right gutter (never over text)
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
        color: "#cdd6dd",
        background: "rgba(0,0,0,0.28)",
        padding: 0,
    },
    chevronMine: {},
    chevronTheirs: {},

    // the small React / Reply menu — drops DOWN from just under the chevron,
    // pinned to the bubble's top-right corner (beside where you clicked).
    actionMenu: {
        position: "absolute",
        top: "24px",
        left: "0",
        zIndex: 20,
        display: "flex",
        flexDirection: "column",
        minWidth: "120px",
        background: "#233138",
        border: "1px solid #2a3942",
        borderRadius: "8px",
        boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
        overflow: "hidden",
    },
    actionMenuItem: {
        border: "none",
        background: "transparent",
        color: "#e9edef",
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
    deletedText: { fontStyle: "italic", color: "#8696a0", fontSize: "13.5px" },

    // reactions: pill row UNDER the bubble
    pillRow: { display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "3px" },
    pill: {
        display: "inline-flex",
        alignItems: "center",
        gap: "3px",
        border: "1px solid #2a3942",
        background: "#1d282f",
        borderRadius: "11px",
        padding: "1px 7px",
        fontSize: "12px",
        cursor: "pointer",
        color: "#e9edef",
        lineHeight: 1.6,
    },
    pillMine: { border: "1px solid #00a884", background: "#0c3a30" },
    pillCount: { fontSize: "11px", color: "#c5cdd3" },

    // reactions: the quick-pick popover — drops DOWN from the chevron corner
    emojiPopover: {
        position: "absolute",
        left: "0",
        right: "2px",
        zIndex: 20,
        display: "flex",
        gap: "2px",
        padding: "4px 6px",
        background: "#233138",
        border: "1px solid #2a3942",
        borderRadius: "22px",
        boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
    },
    emojiChoice: {
        border: "none",
        background: "transparent",
        cursor: "pointer",
        fontSize: "20px",
        lineHeight: 1,
        padding: "2px 4px",
        borderRadius: "6px",
    },

    // reply: the quote block rendered INSIDE a reply bubble
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
        color: "#c5cdd3",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        maxWidth: "260px",
    },
    quoteDeleted: { fontStyle: "italic", color: "#8696a0" },

    // reply: the preview bar above the composer
    composerWrap: { borderTop: "1px solid #222d34", background: "#111b21" },
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
        background: "#1d282f",
        borderRadius: "4px",
        padding: "4px 8px",
        overflow: "hidden",
    },
    replyBarAuthor: { fontSize: "12px", fontWeight: 600, color: "#00a884" },
    replyBarText: {
        fontSize: "12.5px",
        color: "#c5cdd3",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },
    replyBarClose: {
        border: "none",
        background: "transparent",
        color: "#8696a0",
        cursor: "pointer",
        fontSize: "16px",
        lineHeight: 1,
        padding: "4px",
    },

    // media styles
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
        background: "#2a3942",
        color: "#e9edef",
        cursor: "pointer",
        fontSize: "16px",
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