import { createContext, useContext, useState } from "react";

/*
 * NotificationContext is a shared "storage box" for notification data.
 *
 * Without this, the ChatPage (where messages arrive) and the bell icon
 * (shown on every page) cannot communicate with each other.
 * Context solves this — it's like a global variable, but the React way.
 *
 * How to use in any component:
 *   const { totalUnread } = useNotification();
 */

// Step 1: Create an empty context (just a placeholder for now)
const NotificationContext = createContext(null);

// Step 2: Provider — wrap your whole app with this in main.jsx
export function NotificationProvider({ children }) {

    // The number shown on the 🔔 bell badge (e.g. 5)
    const [totalUnread, setTotalUnread] = useState(0);

    // Unread count per conversation  e.g. { "dm:1:2": 3, "group:5": 1 }
    const [unreadPerConversation, setUnreadPerConversation] = useState({});

    // Last 10 notifications for the dropdown list
    const [recentNotifications, setRecentNotifications] = useState([]);

    /*
     * handleNotification
     * Call this when a WebSocket notification arrives.
     * The notification object looks like:
     *   {
     *     conversationId: "dm:1:2",
     *     senderName: "John",
     *     preview: "Hey, are you free?",
     *     conversationUnread: 3,
     *     totalUnread: 5,
     *   }
     */
    const handleNotification = (notification) => {
        setTotalUnread(notification.totalUnread);

        setUnreadPerConversation(prev => ({
            ...prev,
            [notification.conversationId]: notification.conversationUnread,
        }));

        // Add to front of list, keep only the latest 10
        setRecentNotifications(prev =>
            [notification, ...prev].slice(0, 10)
        );
    };

    /*
     * clearConversation
     * Call this when the user opens a conversation (reads the messages).
     * Removes that conversation's count from the badge.
     */
    const clearConversation = (conversationId) => {
        setUnreadPerConversation(prev => {
            const updated = { ...prev };
            delete updated[conversationId];

            // Recalculate total from what's left
            const newTotal = Object.values(updated)
                .reduce((sum, count) => sum + count, 0);
            setTotalUnread(newTotal);

            return updated;
        });
    };

    // Everything the rest of the app can access
    const value = {
        totalUnread,
        unreadPerConversation,
        recentNotifications,
        handleNotification,
        clearConversation,
    };

    return (
        <NotificationContext.Provider value={value}>
            {children}
        </NotificationContext.Provider>
    );
}

// Step 3: Custom hook — the easy way to use this context in any component
export function useNotification() {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error("useNotification must be used inside <NotificationProvider>");
    }
    return context;
}