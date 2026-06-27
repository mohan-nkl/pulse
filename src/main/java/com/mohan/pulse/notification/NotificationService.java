package com.mohan.pulse.notification;

import com.mohan.pulse.notification.dtos.NotificationDto;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private static final String NOTIFICATION_QUEUE = "/queue/notifications";
    private static final int MAX_PREVIEW_LENGTH = 50;

    private final Map<Long, Map<String, Integer>> unreadByUser = new HashMap<>();

    private final SimpMessagingTemplate messagingTemplate;

    public synchronized void sendNotification(Long recipientId,
                                              String conversationId,
                                              String senderName,
                                              String messageContent) {
        pushMessageNotification(recipientId, conversationId, senderName, buildPreview(messageContent));
    }

    public synchronized void sendGroupNotification(Long recipientId,
                                                   String conversationId,
                                                   String groupName,
                                                   String senderName,
                                                   String messageContent) {
        String preview = senderName + ": " + buildPreview(messageContent);
        pushMessageNotification(recipientId, conversationId, groupName, preview);
    }

    private void pushMessageNotification(Long recipientId,
                                         String conversationId,
                                         String title,
                                         String preview) {
        Map<String, Integer> userUnread = unreadFor(recipientId);

        int currentCount = userUnread.getOrDefault(conversationId, 0);
        int newCount = currentCount + 1;
        userUnread.put(conversationId, newCount);

        int totalUnread = totalUnreadFor(userUnread);

        NotificationDto notification = new NotificationDto(
                "MESSAGE",
                conversationId,
                title,
                preview,
                newCount,
                totalUnread);

        messagingTemplate.convertAndSendToUser(
                recipientId.toString(), NOTIFICATION_QUEUE, notification);
    }

    public void sendReactionNotification(Long recipientId,
                                         String conversationId,
                                         String reactorName,
                                         String emoji) {

        String emojiText;
        if (emoji == null) {
            emojiText = "";
        } else {
            emojiText = emoji;
        }
        String preview = "Reacted " + emojiText + " to your message";

        NotificationDto notification = new NotificationDto(
                "REACTION",
                conversationId,
                reactorName,
                preview,
                0,
                0);

        messagingTemplate.convertAndSendToUser(
                recipientId.toString(), NOTIFICATION_QUEUE, notification);
    }

    public synchronized void clearUnread(Long userId, String conversationId) {
        Map<String, Integer> userUnread = unreadByUser.get(userId);
        if (userUnread != null) {
            userUnread.remove(conversationId);
        }
    }

    private Map<String, Integer> unreadFor(Long userId) {
        Map<String, Integer> userUnread = unreadByUser.get(userId);
        if (userUnread == null) {
            userUnread = new HashMap<>();
            unreadByUser.put(userId, userUnread);
        }
        return userUnread;
    }

    private int totalUnreadFor(Map<String, Integer> userUnread) {
        int total = 0;
        for (int count : userUnread.values()) {
            total += count;
        }
        return total;
    }

    private String buildPreview(String messageContent) {
        boolean hasContent = (messageContent != null && !messageContent.isBlank());

        String text;
        if (hasContent) {
            text = messageContent;
        } else {
            text = "📎 Media";
        }

        boolean tooLong = text.length() > MAX_PREVIEW_LENGTH;
        if (tooLong) {
            return text.substring(0, MAX_PREVIEW_LENGTH) + "...";
        }
        return text;
    }
}