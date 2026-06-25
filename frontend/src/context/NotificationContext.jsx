import { createContext, useContext, useState, useCallback } from "react";
import client from "../api/client";

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {

    const [unreadPerConversation, setUnreadPerConversation] = useState({});

    const [recentNotifications, setRecentNotifications] = useState([]);

    const totalUnread = Object.values(unreadPerConversation)
        .reduce((sum, n) => sum + (n || 0), 0);

    const refreshUnreadCounts = useCallback(async () => {
        try {
            const res = await client.get("/api/conversations/unread-counts");
            const counts = res.data?.data || {};
            setUnreadPerConversation(counts);
        } catch {

        }
    }, []);

    const handleNotification = useCallback((notification) => {
        setUnreadPerConversation((prev) => ({
            ...prev,
            [notification.conversationId]:
                (prev[notification.conversationId] || 0) + 1,
        }));

        setRecentNotifications((prev) =>
            [notification, ...prev].slice(0, 10)
        );
    }, []);

    const clearConversation = useCallback((conversationId) => {
        setUnreadPerConversation((prev) => {
            if (!prev[conversationId]) return prev;
            const updated = { ...prev };
            delete updated[conversationId];
            return updated;
        });
    }, []);

    const value = {
        totalUnread,
        unreadPerConversation,
        recentNotifications,
        handleNotification,
        clearConversation,
        refreshUnreadCounts,
    };

    return (
        <NotificationContext.Provider value={value}>
            {children}
        </NotificationContext.Provider>
    );
}

export function useNotification() {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error("useNotification must be used inside <NotificationProvider>");
    }
    return context;
}
