package com.mohan.pulse.message;

import com.mohan.pulse.common.ApiException;
import com.mohan.pulse.message.dtos.MessageInfoResponse;
import com.mohan.pulse.message.dtos.MessageStatusUpdate;
import com.mohan.pulse.message.dtos.RecipientStatusEntry;
import com.mohan.pulse.storage.StorageService;
import com.mohan.pulse.user.User;
import com.mohan.pulse.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class MessageStatusService {

    private static final String USER_STATUS_QUEUE = "/queue/status";

    private final MessageRecipientStatusRepository statusRepository;
    private final MessageRepository messageRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final StorageService storageService;

    @Transactional
    public void createRecipientStatuses(Message message, List<Long> recipientIds) {
        List<MessageRecipientStatus> rows = new ArrayList<>();
        for (Long recipientId : recipientIds) {
            MessageRecipientStatus row = new MessageRecipientStatus();
            row.setMessage(message);
            row.setRecipient(userRepository.getReferenceById(recipientId));
            row.setStatus(MessageStatus.SENT);
            rows.add(row);
        }
        statusRepository.saveAll(rows);
    }

    @Transactional
    public void markDelivered(Long recipientId, String conversationId) {
        List<MessageRecipientStatus> myRows;
        if (conversationId == null) {
            myRows = statusRepository.findByRecipient_IdAndStatus(recipientId, MessageStatus.SENT);
        } else {
            myRows = statusRepository.findByRecipient_IdAndMessage_ConversationIdAndStatus(
                    recipientId, conversationId, MessageStatus.SENT);
        }

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
        Message message = findMessageOrThrow(messageId);

        boolean requesterIsSender = message.getSender().getId().equals(requesterId);
        if (!requesterIsSender) {
            throw new ApiException(HttpStatus.FORBIDDEN,
                    "You can only see delivery info for your own messages.");
        }

        List<MessageRecipientStatus> rows = statusRepository.findByMessage_Id(messageId);

        List<RecipientStatusEntry> entries = new ArrayList<>();
        for (MessageRecipientStatus row : rows) {
            entries.add(toRecipientStatusEntry(row));
        }

        int total = rows.size();
        int delivered = countAtLeastDelivered(rows);
        int read = countRead(rows);

        return new MessageInfoResponse(messageId, total, delivered, read, entries);
    }

    @Transactional(readOnly = true)
    public Map<Long, MessageStatusUpdate> statusForMessages(List<Long> messageIds) {
        if (messageIds.isEmpty()) {
            return Map.of();
        }

        List<MessageRecipientStatus> allRows = statusRepository.findByMessage_IdIn(messageIds);
        Map<Long, List<MessageRecipientStatus>> rowsByMessageId = groupByMessageId(allRows);

        Map<Long, MessageStatusUpdate> result = new HashMap<>();
        for (Long messageId : messageIds) {
            List<MessageRecipientStatus> rows = rowsByMessageId.getOrDefault(messageId, List.of());

            int total = rows.size();
            int delivered = countAtLeastDelivered(rows);
            int read = countRead(rows);
            MessageStatus aggregatedStatus = aggregate(total, delivered, read);

            MessageStatusUpdate update = new MessageStatusUpdate(
                    messageId, null, aggregatedStatus, delivered, read, total);
            result.put(messageId, update);
        }
        return result;
    }

    private void notifySenders(List<MessageRecipientStatus> changedRows) {
        List<Long> messageIds = distinctMessageIds(changedRows);

        List<MessageRecipientStatus> allRows = statusRepository.findByMessage_IdIn(messageIds);
        Map<Long, List<MessageRecipientStatus>> rowsByMessageId = groupByMessageId(allRows);

        for (List<MessageRecipientStatus> rows : rowsByMessageId.values()) {
            Message message = rows.get(0).getMessage();

            int total = rows.size();
            int delivered = countAtLeastDelivered(rows);
            int read = countRead(rows);
            MessageStatus aggregatedStatus = aggregate(total, delivered, read);

            MessageStatusUpdate update = new MessageStatusUpdate(
                    message.getId(),
                    message.getConversationId(),
                    aggregatedStatus,
                    delivered, read, total);

            messagingTemplate.convertAndSendToUser(
                    message.getSender().getId().toString(), USER_STATUS_QUEUE, update);
        }
    }

    private Map<Long, List<MessageRecipientStatus>> groupByMessageId(List<MessageRecipientStatus> rows) {
        Map<Long, List<MessageRecipientStatus>> rowsByMessageId = new HashMap<>();
        for (MessageRecipientStatus row : rows) {
            Long messageId = row.getMessage().getId();

            List<MessageRecipientStatus> group = rowsByMessageId.get(messageId);
            if (group == null) {
                group = new ArrayList<>();
                rowsByMessageId.put(messageId, group);
            }
            group.add(row);
        }
        return rowsByMessageId;
    }

    private List<Long> distinctMessageIds(List<MessageRecipientStatus> rows) {
        List<Long> messageIds = new ArrayList<>();
        for (MessageRecipientStatus row : rows) {
            Long messageId = row.getMessage().getId();

            boolean alreadyAdded = messageIds.contains(messageId);
            if (!alreadyAdded) {
                messageIds.add(messageId);
            }
        }
        return messageIds;
    }

    private RecipientStatusEntry toRecipientStatusEntry(MessageRecipientStatus row) {
        User recipient = row.getRecipient();
        String avatarUrl = storageService.presignedUrl(recipient.getAvatarUrl());

        return new RecipientStatusEntry(
                recipient.getId(),
                recipient.getName(),
                avatarUrl,
                row.getStatus(),
                row.getDeliveredAt(),
                row.getReadAt());
    }

    private int countAtLeastDelivered(List<MessageRecipientStatus> rows) {
        int count = 0;
        for (MessageRecipientStatus row : rows) {
            boolean deliveredOrRead =
                    (row.getStatus() == MessageStatus.DELIVERED || row.getStatus() == MessageStatus.READ);
            if (deliveredOrRead) {
                count++;
            }
        }
        return count;
    }

    private int countRead(List<MessageRecipientStatus> rows) {
        int count = 0;
        for (MessageRecipientStatus row : rows) {
            if (row.getStatus() == MessageStatus.READ) {
                count++;
            }
        }
        return count;
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

    private Message findMessageOrThrow(Long messageId) {
        Optional<Message> maybeMessage = messageRepository.findById(messageId);
        if (maybeMessage.isEmpty()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Message not found.");
        }
        return maybeMessage.get();
    }
}