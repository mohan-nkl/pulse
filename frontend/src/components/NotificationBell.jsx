import { useState } from "react";
import { useNotification } from "../context/NotificationContext";

/*
 * NotificationBell renders a 🔔 icon with a red count badge.
 * Clicking it opens a dropdown showing recent notifications.
 *
 * Drop it anywhere — it reads from context automatically:
 *   import NotificationBell from "../components/NotificationBell";
 *   <NotificationBell />
 */
export default function NotificationBell() {

    const { totalUnread, recentNotifications } = useNotification();

    // true = dropdown is open, false = dropdown is hidden
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div style={{ position: "relative", display: "inline-block" }}>

            {/* Bell button */}
            <button
                onClick={() => setIsOpen(prev => !prev)}
                style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "22px",
                    position: "relative",
                    padding: "4px 8px",
                    lineHeight: 1,
                }}
            >
                🔔

                {/* Red badge — only visible when totalUnread > 0 */}
                {totalUnread > 0 && (
                    <span style={{
                        position: "absolute",
                        top: "-2px",
                        right: "-2px",
                        backgroundColor: "#e53935",
                        color: "white",
                        borderRadius: "50%",
                        minWidth: "18px",
                        height: "18px",
                        fontSize: "10px",
                        fontWeight: "bold",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "0 4px",
                        boxSizing: "border-box",
                    }}>
                        {totalUnread > 99 ? "99+" : totalUnread}
                    </span>
                )}
            </button>

            {/* Dropdown — shown only when isOpen is true */}
            {isOpen && (
                <div style={{
                    position: "absolute",
                    right: 0,
                    top: "40px",
                    width: "300px",
                    backgroundColor: "white",
                    border: "1px solid #e0e0e0",
                    borderRadius: "10px",
                    boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
                    zIndex: 1000,
                    overflow: "hidden",
                }}>
                    {/* Header bar */}
                    <div style={{
                        padding: "14px 16px",
                        borderBottom: "1px solid #f0f0f0",
                        fontWeight: "700",
                        fontSize: "15px",
                        color: "#111",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                    }}>
                        <span>Notifications</span>
                        {totalUnread > 0 && (
                            <span style={{
                                backgroundColor: "#e53935",
                                color: "white",
                                borderRadius: "12px",
                                padding: "2px 8px",
                                fontSize: "11px",
                            }}>
                                {totalUnread} new
                            </span>
                        )}
                    </div>

                    {/* Empty state */}
                    {recentNotifications.length === 0 ? (
                        <div style={{
                            padding: "24px 16px",
                            textAlign: "center",
                            color: "#999",
                            fontSize: "13px",
                        }}>
                            No new notifications
                        </div>
                    ) : (
                        // One row per notification
                        recentNotifications.map((notif, index) => (
                            <div
                                key={index}
                                style={{
                                    padding: "12px 16px",
                                    borderBottom: "1px solid #f8f8f8",
                                    cursor: "pointer",
                                }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = "#f5f5f5"}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = "white"}
                            >
                                {/* Sender name */}
                                <div style={{ fontWeight: "600", fontSize: "13px", color: "#111" }}>
                                    {notif.senderName}
                                </div>

                                {/* Message preview — truncated with "..." if too long */}
                                <div style={{
                                    fontSize: "12px",
                                    color: "#555",
                                    marginTop: "2px",
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                }}>
                                    {notif.preview}
                                </div>

                                {/* "X more messages" hint */}
                                {notif.conversationUnread > 1 && (
                                    <div style={{ marginTop: "3px", fontSize: "11px", color: "#25d366", fontWeight: "600" }}>
                                        +{notif.conversationUnread - 1} more
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}