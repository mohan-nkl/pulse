import { useEffect, useState } from "react";

export default function NotificationToast({ notification, onClose, onClick }) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!notification) return;

        setVisible(true);

        const timer = setTimeout(() => {
            setVisible(false);
            setTimeout(onClose, 300);
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
                background: "var(--c-incoming)",
                color: "var(--c-text)",
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
            {}
            <div style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                background: "var(--c-accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "700",
                fontSize: "16px",
                flexShrink: 0,
            }}>
                {notification.senderName?.[0]?.toUpperCase() || "?"}
            </div>

            {}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: "600", fontSize: "14px", marginBottom: "2px" }}>
                    {notification.senderName}
                </div>
                <div style={{
                    fontSize: "13px",
                    color: "var(--c-muted)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                }}>
                    {notification.preview}
                </div>
            </div>

            {}
            <button
                onClick={(e) => { e.stopPropagation(); setVisible(false); setTimeout(onClose, 300); }}
                style={{
                    background: "none",
                    border: "none",
                    color: "var(--c-muted)",
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
