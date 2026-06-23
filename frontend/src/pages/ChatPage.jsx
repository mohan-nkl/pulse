import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import client from "../api/client";
import { uploadMedia, getMessageType } from "../api/mediaApi"; // NEW
import {
    connectWebSocket,
    sendMessage,
    sendGroupMessage,
    sendDelivered,
    sendRead,
    disconnectWebSocket,
} from "../services/WebSocket.js";
import { listGroups, getGroupHistory, getGroupMembers } from "../api/groupApi";
import NewGroupModal from "../components/NewGroupModal";
import GroupMembersPanel from "../components/GroupMembersPanel";

function dmConversationId(a, b) {
    const smaller = Math.min(a, b);
    const larger  = Math.max(a, b);
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

function Ticks({ message }) {
    const status      = message.status || "SENT";
    const isRead      = status === "READ";
    const isDelivered = status === "DELIVERED" || isRead;
    const symbol      = isDelivered ? "✓✓" : "✓";
    const color       = isRead ? "#4fc3f7" : "#a8c5bd";
    return <span style={{ color, fontWeight: 700 }}>{symbol}</span>;
}

/**
 * NEW: Renders the body of a message bubble.
 * For TEXT: shows the text.
 * For IMAGE/VIDEO/AUDIO/FILE: shows the correct media element.
 */
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

    // Default: plain text
    return <span style={styles.text}>{content}</span>;
}

export default function ChatPage() {
    const { user }      = useAuth();
    const currentUserId = user?.userId;

    const [contacts,    setContacts]    = useState([]);
    const [groups,      setGroups]      = useState([]);
    const [selected,    setSelected]    = useState(null);
    const [messages,    setMessages]    = useState([]);
    const [draft,       setDraft]       = useState("");
    const [memberNames, setMemberNames] = useState({});
    const [showNewGroup, setShowNewGroup] = useState(false);
    const [showMembers,  setShowMembers]  = useState(false);

    const [isUploading,  setIsUploading]  = useState(false);
    const [lightboxUrl,  setLightboxUrl]  = useState(null);

    const openConversationIdRef = useRef(null);
    const bottomRef             = useRef(null);
    const currentUserIdRef      = useRef(null);

    // NEW: ref for the hidden file input
    const fileInputRef = useRef(null);

    useEffect(() => {
        currentUserIdRef.current = currentUserId;
    }, [currentUserId]);

    // Persist selected chat so reload restores it
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
        const init = async () => {
            const [loadedContacts, loadedGroups] = await Promise.all([loadContacts(), loadGroups()]);

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
                    }
                    return;
                }

                if (message.conversationId === openConversationIdRef.current) {
                    setMessages((prev) => [...prev, message]);
                    sendRead(message.conversationId);
                } else {
                    sendDelivered(message.conversationId);
                }
            },
            (update) => {
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === update.messageId
                            ? {
                                ...m,
                                status:           update.status,
                                deliveredCount:   update.deliveredCount,
                                readCount:        update.readCount,
                                totalRecipients:  update.totalRecipients,
                            }
                            : m
                    )
                );
            }
        );

        return () => disconnectWebSocket();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const loadContacts = async () => {
        try {
            const response = await client.get("/api/v1/contacts");
            const mapped   = (response.data.data || []).map((c) => ({
                userId:    c.contactId,
                name:      c.alias || c.name,
                avatarUrl: c.avatarUrl,
            }));
            setContacts(mapped);
            return mapped;
        } catch { return []; }
    };

    const loadGroups = async () => {
        try {
            const data = await listGroups();
            setGroups(data);
            return data;
        } catch { return []; }
    };

    const openDirect = async (contact) => {
        const convId = dmConversationId(currentUserId, contact.userId);
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

        sendRead(convId);
    };

    const openGroup = async (group) => {
        const convId = groupConversationId(group.id);
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
            members.forEach((m) => { names[m.userId] = m.name; });
            setMemberNames(names);
        } catch {
            setMessages([]);
            setMemberNames({});
        }

        sendRead(convId);
    };

    const handleSend = () => {
        const text = draft.trim();
        if (!text || !selected) return;

        if (selected.type === "dm") {
            sendMessage(selected.userId, text);
        } else {
            sendGroupMessage(selected.id, text);
        }
        setDraft("");
    };

    // NEW: called when user picks a file from the file picker
    const handleFileSelected = async (event) => {
        const file = event.target.files[0];
        if (!file || !selected) return;

        // Reset so picking the same file again still fires onChange
        event.target.value = "";

        const messageType = getMessageType(file); // "IMAGE", "VIDEO", "AUDIO", or "FILE"

        setIsUploading(true);
        try {
            const mediaUrl = await uploadMedia(file); // upload to server, get back URL

            if (selected.type === "dm") {
                sendMessage(selected.userId, "", messageType, mediaUrl);
            } else {
                sendGroupMessage(selected.id, "", messageType, mediaUrl);
            }
        } catch (error) {
            console.error("Media upload failed:", error);
            alert("Upload failed. Please try again.");
        } finally {
            setIsUploading(false);
        }
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
                                ? styles.itemActive : {}),
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
                                ? styles.itemActive : {}),
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
                                const mine       = message.senderId === currentUserId;
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

                                        {/* NEW: renders text, image, video, audio, or file */}
                                        <MessageContent message={message} onImageClick={setLightboxUrl} />

                                        <span style={styles.meta}>
                                            <span style={styles.time}>{formatTime(message.createdAt)}</span>
                                            {mine && <Ticks message={message} />}
                                        </span>
                                    </div>
                                );
                            })}
                            <div ref={bottomRef} />
                        </div>

                        <div style={styles.composer}>

                            {/* NEW: hidden file input */}
                            <input
                                ref={fileInputRef}
                                type="file"
                                style={{ display: "none" }}
                                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
                                onChange={handleFileSelected}
                            />

                            {/* NEW: paperclip button */}
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
                                onChange={(e) => setDraft(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                                placeholder="Type a message"
                                disabled={isUploading}
                            />

                            <button
                                style={styles.sendButton}
                                onClick={handleSend}
                                disabled={isUploading}
                            >
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

            <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
        </div>
    );
}

const styles = {
    page:     { display: "flex", height: "100vh", background: "#0b141a", color: "#e9edef" },
    sidebar:  { width: "280px", borderRight: "1px solid #222d34", overflowY: "auto",
        padding: "12px", background: "#111b21" },
    sidebarHeader: { display: "flex", alignItems: "center", justifyContent: "space-between",
        margin: "4px 8px 12px" },
    sidebarTitle:  { fontSize: "18px", margin: 0, color: "#e9edef" },
    newGroupBtn:   { fontSize: "12px", padding: "6px 10px", border: "none", borderRadius: "6px",
        background: "#00a884", color: "#fff", cursor: "pointer" },
    sectionLabel:  { fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px",
        color: "#8696a0", margin: "14px 8px 6px" },
    empty:       { fontSize: "14px", color: "#8696a0", padding: "0 8px" },
    item:        { display: "block", width: "100%", textAlign: "left", padding: "10px 8px",
        border: "none", background: "transparent", cursor: "pointer",
        fontSize: "15px", borderRadius: "6px", color: "#e9edef" },
    itemActive:  { background: "#2a3942" },
    chat:        { flex: 1, display: "flex", flexDirection: "column", background: "#0b141a" },
    placeholder: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        color: "#8696a0" },
    chatHeader:  { padding: "14px 16px", borderBottom: "1px solid #222d34", fontWeight: 600,
        color: "#e9edef", display: "flex", alignItems: "center",
        justifyContent: "space-between" },
    infoBtn:     { fontSize: "13px", padding: "6px 12px", border: "1px solid #2a3942",
        borderRadius: "6px", background: "transparent", color: "#e9edef",
        cursor: "pointer" },
    messages:    { flex: 1, overflowY: "auto", padding: "16px", display: "flex",
        flexDirection: "column", gap: "8px" },
    bubble:      { maxWidth: "65%", padding: "6px 10px 5px 12px", borderRadius: "12px",
        fontSize: "14px", lineHeight: 1.4, display: "flex", flexDirection: "column" },
    bubbleMine:  { alignSelf: "flex-end",   background: "#005c4b", color: "#e9edef" },
    bubbleTheirs:{ alignSelf: "flex-start", background: "#202c33", color: "#e9edef" },
    sender:      { fontSize: "12px", color: "#53bdeb", marginBottom: "2px", fontWeight: 600 },
    text:        { whiteSpace: "pre-wrap", wordBreak: "break-word", textAlign: "left" },
    meta:        { alignSelf: "flex-end", display: "inline-flex", alignItems: "center",
        gap: "4px", marginTop: "2px", whiteSpace: "nowrap" },
    time:        { fontSize: "11px", color: "#9fc1b8" },

    // NEW: media styles
    mediaImage:  { maxWidth: "240px", maxHeight: "240px", borderRadius: "8px",
        cursor: "pointer", display: "block", marginBottom: "4px" },
    mediaVideo:  { maxWidth: "280px", borderRadius: "8px", display: "block", marginBottom: "4px" },
    mediaAudio:  { maxWidth: "260px", display: "block", marginBottom: "4px" },
    fileLink:    { color: "#53bdeb", textDecoration: "none", display: "block", marginBottom: "4px" },
    caption:     { margin: "4px 0 0", fontSize: "13px" },

    composer:    { display: "flex", gap: "8px", padding: "12px",
        borderTop: "1px solid #222d34", background: "#111b21" },
    attachButton:{ padding: "10px 12px", border: "none", borderRadius: "6px",
        background: "#2a3942", color: "#e9edef", cursor: "pointer", fontSize: "16px" },
    input:       { flex: 1, padding: "10px", fontSize: "14px", border: "1px solid #2a3942",
        borderRadius: "6px", background: "#2a3942", color: "#e9edef", outline: "none" },
    sendButton:  { padding: "10px 18px", border: "none", borderRadius: "6px",
        cursor: "pointer", background: "#00a884", color: "#fff" },

    lightboxOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
    lightboxImg:     { maxWidth: "90vw", maxHeight: "90vh", borderRadius: "8px",
        objectFit: "contain" },
    lightboxClose:   { position: "absolute", top: "16px", right: "20px", background: "none",
        border: "none", color: "#fff", fontSize: "28px", cursor: "pointer", lineHeight: 1 },
};