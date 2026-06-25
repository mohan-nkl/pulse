package com.mohan.pulse.message;

import com.mohan.pulse.common.ApiException;
import com.mohan.pulse.common.ConversationUtil;
import com.mohan.pulse.group.GroupMember;
import com.mohan.pulse.group.GroupMemberRepository;
import com.mohan.pulse.message.dtos.MessageDeletedEvent;
import com.mohan.pulse.message.dtos.MessageEditedEvent;
import com.mohan.pulse.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class MessageActionService {

    private static final Duration DELETE_FOR_EVERYONE_WINDOW = Duration.ofHours(1);
    private static final String DELETED_QUEUE = "/queue/message-deleted";

    private static final Duration EDIT_WINDOW = Duration.ofMinutes(30);
    private static final String EDITED_QUEUE = "/queue/message-edited";

    private final MessageRepository messageRepository;
    private final DeletedMessageRepository deletedMessageRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @Transactional
    public void deleteForMe(Long userId, Long messageId) {
        Message message = findMessageOrThrow(messageId);
        ensureMember(userId, message.getConversationId());

        boolean alreadyHidden = deletedMessageRepository.existsByMessage_IdAndUser_Id(messageId, userId);
        if (alreadyHidden) {
            return;
        }

        DeletedMessage hidden = new DeletedMessage();
        hidden.setMessage(message);
        hidden.setUser(userRepository.getReferenceById(userId));
        deletedMessageRepository.save(hidden);
    }

    @Transactional
    public void deleteForEveryone(Long userId, Long messageId) {
        Message message = findMessageOrThrow(messageId);

        boolean senderIsCaller = message.getSender().getId().equals(userId);
        if (!senderIsCaller) {
            throw new ApiException(HttpStatus.FORBIDDEN,
                    "You can only delete your own messages for everyone.");
        }

        if (message.isDeleted()) {
            return;
        }

        boolean tooOld = isOlderThan(message, DELETE_FOR_EVERYONE_WINDOW);
        if (tooOld) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "This message is too old to delete for everyone.");
        }

        message.setDeleted(true);
        message.setContent(null);
        message.setMediaUrl(null);
        messageRepository.save(message);

        broadcastDeleted(message);
    }

    @Transactional
    public void editMessage(Long userId, Long messageId, String newContent) {
        Message message = findMessageOrThrow(messageId);

        boolean senderIsCaller = message.getSender().getId().equals(userId);
        if (!senderIsCaller) {
            throw new ApiException(HttpStatus.FORBIDDEN, "You can only edit your own messages.");
        }

        if (message.isDeleted()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "You cannot edit a deleted message.");
        }

        boolean notTextMessage = (message.getType() != MessageType.TEXT);
        if (notTextMessage) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Only text messages can be edited.");
        }

        boolean contentMissing = (newContent == null || newContent.isBlank());
        if (contentMissing) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Edited message cannot be empty.");
        }

        boolean tooOld = isOlderThan(message, EDIT_WINDOW);
        if (tooOld) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "This message is too old to edit.");
        }

        message.setContent(newContent.trim());
        message.setEdited(true);
        messageRepository.save(message);

        broadcastEdited(message);
    }

    private void broadcastDeleted(Message message) {
        MessageDeletedEvent event = new MessageDeletedEvent(message.getId(), message.getConversationId());

        for (Long recipientId : recipientsOf(message.getConversationId())) {
            messagingTemplate.convertAndSendToUser(recipientId.toString(), DELETED_QUEUE, event);
        }
    }

    private void broadcastEdited(Message message) {
        MessageEditedEvent event = new MessageEditedEvent(
                message.getId(), message.getConversationId(), message.getContent());

        for (Long recipientId : recipientsOf(message.getConversationId())) {
            messagingTemplate.convertAndSendToUser(recipientId.toString(), EDITED_QUEUE, event);
        }
    }

    private List<Long> recipientsOf(String conversationId) {
        List<Long> recipientIds = new ArrayList<>();

        if (ConversationUtil.isDirect(conversationId)) {
            long[] participants = ConversationUtil.dmParticipants(conversationId);
            recipientIds.add(participants[0]);
            recipientIds.add(participants[1]);
        } else if (ConversationUtil.isGroup(conversationId)) {
            Long groupId = ConversationUtil.groupIdFrom(conversationId);
            for (GroupMember member : groupMemberRepository.findByGroupId(groupId)) {
                recipientIds.add(member.getUser().getId());
            }
        }
        return recipientIds;
    }

    private void ensureMember(Long userId, String conversationId) {
        if (ConversationUtil.isDirect(conversationId)) {
            long[] participants = ConversationUtil.dmParticipants(conversationId);
            boolean isParticipant = (userId == participants[0] || userId == participants[1]);
            if (!isParticipant) {
                throw new ApiException(HttpStatus.FORBIDDEN, "You are not part of this conversation.");
            }
        } else if (ConversationUtil.isGroup(conversationId)) {
            Long groupId = ConversationUtil.groupIdFrom(conversationId);
            boolean isMember = groupMemberRepository.existsByGroupIdAndUserId(groupId, userId);
            if (!isMember) {
                throw new ApiException(HttpStatus.FORBIDDEN, "You are not a member of this group.");
            }
        }
    }

    private boolean isOlderThan(Message message, Duration window) {
        Duration age = Duration.between(message.getCreatedAt(), Instant.now());
        return age.compareTo(window) > 0;
    }

    private Message findMessageOrThrow(Long messageId) {
        Optional<Message> maybeMessage = messageRepository.findById(messageId);
        if (maybeMessage.isEmpty()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Message not found.");
        }
        return maybeMessage.get();
    }
}