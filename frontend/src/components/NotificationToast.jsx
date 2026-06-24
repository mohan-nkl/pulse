import { useEffect, useState } from "react";

/*
 * Shows a WhatsApp-style banner at the top of the screen when a message
 * arrives. Auto-dismisses after 4 seconds. Clicking it opens the chat.
 *
 * Props:
 *   notification  — { senderName, preview, conversationId }  or  null
 *   onClose       — called when dismissed
 *   onClick       — called when the user clicks the banner
 */
export default function NotificationToast({ notification, onClose, onClick }) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!notification) return;

        // Slide in
        setVisible(true);

        // Auto-dismiss after 4 seconds
        const timer = setTimeout(() => {
            setVisible(false);
            setTimeout(onClose, 300); // wait for slide-out animation
        }, 4000);

        return () => clearTimeout(timer);
    }, [notification]);

    if (!notification) return null;

    return (
        <div
            onClick={() => { onClick(notification.conversationId); setVisible(false); }}
            style={{
                position: "fixed",
                top: visible ? "16px" : "-100px",
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 9999,
                background: "#202c33",
                color: "#e9edef",
                borderRadius: "12px",
                padding: "12px 16px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
                cursor: "pointer",
                minWidth: "280px",
                maxWidth: "360px",
                transition: "top 0.3s ease",
            }}
        >
            {/* Green circle avatar placeholder */}
            <div style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                background: "#00a884",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "700",
                fontSize: "16px",
                flexShrink: 0,
            }}>
                {notification.senderName?.[0]?.toUpperCase() || "?"}
            </div>

            {/* Text */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: "600", fontSize: "14px", marginBottom: "2px" }}>
                    {notification.senderName}
                </div>
                <div style={{
                    fontSize: "13px",
                    color: "#8696a0",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                }}>
                    {notification.preview}
                </div>
            </div>

            {/* Close button */}
            <button
                onClick={(e) => { e.stopPropagation(); setVisible(false); setTimeout(onClose, 300); }}
                style={{
                    background: "none",
                    border: "none",
                    color: "#8696a0",
                    fontSize: "18px",
                    cursor: "pointer",
                    lineHeight: 1,
                    padding: 0,
                    flexShrink: 0,
                }}
            >
                ✕
            </button>
        </div>
    );
}