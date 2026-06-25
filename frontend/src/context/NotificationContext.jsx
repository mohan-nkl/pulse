import { createContext, useContext, useState, useCallback } from "react";
import client from "../api/client";

/*
 * NotificationContext holds the unread badge state for the whole app.
 *
 * SOURCE OF TRUTH: the backend recipient-status table, exposed at
 *   GET /api/conversations/unread-counts  ->  { "dm:1:2": 3, "group:5": 1 }
 * This is the SAME table that drives ticks, so unread and ticks can never
 * disagree.
 *
 * STRATEGY (hybrid): for a responsive feel we bump/clear the badge instantly
 * on socket events, but we RECONCILE against the backend at the moments that
 * matter (app load, opening a conversation, after reading). That way the
 * instant updates never drift — every open re-syncs to the truth.
 */

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {

    // Unread count per conversation  e.g. { "dm:1:2": 3, "group:5": 1 }
    const [unreadPerConversation, setUnreadPerConversation] = useState({});

    // Last 10 notifications for the dropdown list
    const [recentNotifications, setRecentNotifications] = useState([]);

    // Derived: the bell badge total.
    const totalUnread = Object.values(unreadPerConversation)
        .reduce((sum, n) => sum + (n || 0), 0);

    /*
     * refreshUnreadCounts — fetch the authoritative per-conversation unread map
     * from the backend and replace local state with it. This is the reconcile
     * step; call it on load and whenever we want to be certain we're correct.
     */
    const refreshUnreadCounts = useCallback(async () => {
        try {
            const res = await client.get("/api/conversations/unread-counts");
            const counts = res.data?.data || {};
            setUnreadPerConversation(counts);
        } catch {
            /* leave existing counts on failure */
        }
    }, []);

    /*
     * handleNotification — a message arrived for a conversation I'm NOT viewing.
     * Bump that conversation's badge instantly for responsiveness. (The backend
     * remains the source of truth; we reconcile on open.)
     */
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

    /*
     * clearConversation — I opened/read this conversation. Zero its badge
     * immediately. The backend rows are marked READ separately (sendRead), so
     * the next reconcile will agree with this.
     */
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
