package com.mohan.pulse.message;

import com.mohan.pulse.message.dtos.MessageInfoResponse;
import com.mohan.pulse.message.dtos.MessageStatusUpdate;
import com.mohan.pulse.message.dtos.RecipientStatusEntry;
import com.mohan.pulse.common.ApiException;
import com.mohan.pulse.user.User;
import com.mohan.pulse.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;


@Service
@RequiredArgsConstructor
public class MessageStatusService {

    private static final String USER_STATUS_QUEUE = "/queue/status";

    private final MessageRecipientStatusRepository statusRepository;
    private final MessageRepository messageRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;


    @Transactional
    public void createRecipientStatuses(Message message, List<Long> recipientIds) {
        List<MessageRecipientStatus> rows = recipientIds.stream()
                .map(recipientId -> {
                    MessageRecipientStatus row = new MessageRecipientStatus();
                    row.setMessage(message);
                    row.setRecipient(userRepository.getReferenceById(recipientId));
                    row.setStatus(MessageStatus.SENT);
                    return row;
                })
                .toList();
        statusRepository.saveAll(rows);
    }


    @Transactional
    public void markDelivered(Long recipientId, String conversationId) {
        List<MessageRecipientStatus> myRows = (conversationId == null)
                ? statusRepository.findByRecipient_IdAndStatus(recipientId, MessageStatus.SENT)
                : statusRepository.findByRecipient_IdAndMessage_ConversationIdAndStatus(
                recipientId, conversationId, MessageStatus.SENT);

        if (myRows.isEmpty()) {
            return;
        }

        Instant now = Instant.now();
        for (MessageRecipientStatus row : myRows) {
            row.setStatus(MessageStatus.DELIVERED);
            row.setDeliveredAt(now);
        }
        statusRepository.saveAll(myRows);

        notifySenders(myRows);
    }


    @Transactional
    public void markRead(Long recipientId, String conversationId) {
        if (conversationId == null) {
            return;
        }

        List<MessageRecipientStatus> myRows =
                statusRepository.findByRecipient_IdAndMessage_ConversationIdAndStatusNot(
                        recipientId, conversationId, MessageStatus.READ);

        if (myRows.isEmpty()) {
            return;
        }

        Instant now = Instant.now();
        for (MessageRecipientStatus row : myRows) {
            if (row.getDeliveredAt() == null) {
                row.setDeliveredAt(now);
            }
            row.setStatus(MessageStatus.READ);
            row.setReadAt(now);
        }
        statusRepository.saveAll(myRows);

        notifySenders(myRows);
    }


    @Transactional(readOnly = true)
    public MessageInfoResponse getMessageInfo(Long requesterId, Long messageId) {
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Message not found."));

        if (!message.getSender().getId().equals(requesterId)) {
            throw new ApiException(HttpStatus.FORBIDDEN,
                    "You can only see delivery info for your own messages.");
        }

        List<MessageRecipientStatus> rows = statusRepository.findByMessage_Id(messageId);

        List<RecipientStatusEntry> entries = rows.stream()
                .map(row -> {
                    User u = row.getRecipient();
                    return new RecipientStatusEntry(
                            u.getId(), u.getName(), u.getAvatarUrl(),
                            row.getStatus(), row.getDeliveredAt(), row.getReadAt());
                })
                .toList();

        int delivered = countAtLeastDelivered(rows);
        int read = countRead(rows);

        return new MessageInfoResponse(messageId, rows.size(), delivered, read, entries);
    }


    @Transactional(readOnly = true)
    public Map<Long, MessageStatusUpdate> statusForMessages(List<Long> messageIds) {
        if (messageIds.isEmpty()) {
            return Map.of();
        }

        Map<Long, List<MessageRecipientStatus>> rowsByMessage =
                statusRepository.findByMessage_IdIn(messageIds).stream()
                        .collect(Collectors.groupingBy(r -> r.getMessage().getId()));

        Map<Long, MessageStatusUpdate> result = new HashMap<>();
        for (Long id : messageIds) {
            List<MessageRecipientStatus> rows = rowsByMessage.getOrDefault(id, List.of());
            int total = rows.size();
            int delivered = countAtLeastDelivered(rows);
            int read = countRead(rows);
            result.put(id, new MessageStatusUpdate(
                    id, null, aggregate(total, delivered, read), delivered, read, total));
        }
        return result;
    }


    private void notifySenders(List<MessageRecipientStatus> changedRows) {
        List<Long> messageIds = changedRows.stream()
                .map(r -> r.getMessage().getId())
                .distinct()
                .toList();

        Map<Long, List<MessageRecipientStatus>> rowsByMessage =
                statusRepository.findByMessage_IdIn(messageIds).stream()
                        .collect(Collectors.groupingBy(r -> r.getMessage().getId()));

        for (List<MessageRecipientStatus> rows : rowsByMessage.values()) {
            Message message = rows.get(0).getMessage();

            int total = rows.size();
            int delivered = countAtLeastDelivered(rows);
            int read = countRead(rows);

            MessageStatusUpdate update = new MessageStatusUpdate(
                    message.getId(),
                    message.getConversationId(),
                    aggregate(total, delivered, read),
                    delivered, read, total);

            messagingTemplate.convertAndSendToUser(
                    message.getSender().getId().toString(), USER_STATUS_QUEUE, update);
        }
    }

    private int countAtLeastDelivered(List<MessageRecipientStatus> rows) {
        return (int) rows.stream()
                .filter(r -> r.getStatus() == MessageStatus.DELIVERED
                        || r.getStatus() == MessageStatus.READ)
                .count();
    }

    private int countRead(List<MessageRecipientStatus> rows) {
        return (int) rows.stream()
                .filter(r -> r.getStatus() == MessageStatus.READ)
                .count();
    }


    private MessageStatus aggregate(int total, int delivered, int read) {
        if (total == 0) {
            return MessageStatus.SENT;
        }
        if (read == total) {
            return MessageStatus.READ;
        }
        if (delivered == total) {
            return MessageStatus.DELIVERED;
        }
        return MessageStatus.SENT;
    }
}