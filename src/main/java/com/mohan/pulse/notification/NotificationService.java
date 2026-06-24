package com.mohan.pulse.notification;

import com.mohan.pulse.notification.dtos.NotificationDto;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.concurrent.ConcurrentHashMap;

/*
 * NotificationService tracks how many unread messages each user has
 * and pushes live notifications to them through the WebSocket connection.
 *
 * It uses an in-memory map that looks like this:
 *
 *   unreadMap = {
 *       userId 1  ->  { "dm:1:2": 3,  "group:5": 1 }
 *       userId 2  ->  { "dm:1:2": 2 }
 *   }
 *
 * When John sends a message to Alice:
 *   1. Alice's count for that conversation goes up by 1
 *   2. Alice gets a WebSocket notification with the new count
 *
 * When Alice opens the chat and reads the messages:
 *   1. Alice's count for that conversation is cleared to 0
 */
@Service
@RequiredArgsConstructor
public class NotificationService {

    // The WebSocket channel name for notifications
    private static final String NOTIFICATION_QUEUE = "/queue/notifications";

    /*
     * In-memory storage for unread counts.
     * ConcurrentHashMap is thread-safe — it works correctly
     * even when multiple users are sending messages at the same time.
     *
     * Structure:  userId  -->  ( conversationId --> unreadCount )
     */
    private final ConcurrentHashMap<Long, ConcurrentHashMap<String, Integer>> unreadMap
            = new ConcurrentHashMap<>();

    // Spring's class for sending WebSocket messages to specific users
    private final SimpMessagingTemplate messagingTemplate;

    /*
     * Call this when a NEW MESSAGE arrives for a recipient.
     * It increases their unread count and sends them a notification.
     */
    public void sendNotification(Long recipientId,
                                 String conversationId,
                                 String senderName,
                                 String messageContent) {

        // Get (or create) the unread map for this user
        // computeIfAbsent means: "if this user isn't in the map yet, create an empty map for them"
        ConcurrentHashMap<String, Integer> userUnread =
                unreadMap.computeIfAbsent(recipientId, id -> new ConcurrentHashMap<>());

        // Increase the unread count for this conversation by 1
        // merge(key, 1, Integer::sum) means:
        //   if "dm:1:2" doesn't exist  →  set it to 1
        //   if "dm:1:2" is already 2   →  add 1 to get 3
        userUnread.merge(conversationId, 1, Integer::sum);

        // Get the updated counts
        int conversationUnread = userUnread.get(conversationId);
        int totalUnread = userUnread.values().stream()
                .mapToInt(Integer::intValue)
                .sum();

        // Shorten the message to 50 chars for the preview (media messages may have null content)
        String text = (messageContent != null && !messageContent.isBlank()) ? messageContent : "📎 Media";
        String preview = text.length() > 50 ? text.substring(0, 50) + "..." : text;

        // Build the notification object
        NotificationDto notification = new NotificationDto(
                conversationId,
                senderName,
                preview,
                conversationUnread,
                totalUnread
        );

        // Send it to ONLY the recipient via WebSocket
        // Spring will route it to "/user/{recipientId}/queue/notifications"
        messagingTemplate.convertAndSendToUser(
                recipientId.toString(),
                NOTIFICATION_QUEUE,
                notification
        );
    }

    /*
     * Call this when a user READS a conversation (opens the chat).
     * Clears the unread count for that conversation.
     */
    public void clearUnread(Long userId, String conversationId) {
        ConcurrentHashMap<String, Integer> userUnread = unreadMap.get(userId);
        if (userUnread != null) {
            userUnread.remove(conversationId);
        }
    }

    /*
     * Returns the total unread count for a user.
     * Used by the REST endpoint so the frontend can fetch it on page load.
     */
    public int getTotalUnread(Long userId) {
        ConcurrentHashMap<String, Integer> userUnread = unreadMap.get(userId);
        if (userUnread == null) return 0;
        return userUnread.values().stream()
                .mapToInt(Integer::intValue)
                .sum();
    }
}