package com.mohan.pulse.services;

import com.mohan.pulse.dtos.MessageEditedEvent;
import com.mohan.pulse.models.MessageType;
import com.mohan.pulse.dtos.MessageDeletedEvent;
import com.mohan.pulse.exceptions.ApiException;
import com.mohan.pulse.models.DeletedMessage;
import com.mohan.pulse.group.GroupMember;
import com.mohan.pulse.models.Message;
import com.mohan.pulse.repositories.DeletedMessageRepository;
import com.mohan.pulse.group.GroupMemberRepository;
import com.mohan.pulse.repositories.MessageRepository;
import com.mohan.pulse.user.UserRepository;
import com.mohan.pulse.utils.ConversationUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;

@Service
@RequiredArgsConstructor
public class MessageActionService {

    // WhatsApp-style: you can delete-for-everyone within ~1 hour of sending.
    private static final Duration DELETE_FOR_EVERYONE_WINDOW = Duration.ofHours(1);

    private static final String DELETED_QUEUE = "/queue/message-deleted";

    // Sender can edit their own text message within 30 minutes of sending.
    private static final Duration EDIT_WINDOW = Duration.ofMinutes(30);

    private static final String EDITED_QUEUE = "/queue/message-edited";

    private final MessageRepository messageRepository;
    private final DeletedMessageRepository deletedMessageRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @Transactional
    public void deleteForMe(Long userId, Long messageId) {
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Message not found."));

        ensureMember(userId, message.getConversationId());

        if (deletedMessageRepository.existsByMessage_IdAndUser_Id(messageId, userId)) {
            return;
        }

        DeletedMessage hidden = new DeletedMessage();
        hidden.setMessage(message);
        hidden.setUser(userRepository.getReferenceById(userId));
        deletedMessageRepository.save(hidden);
        // No broadcast — this only affects the current user's own view.
    }

    @Transactional
    public void deleteForEveryone(Long userId, Long messageId) {
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Message not found."));

        if (!message.getSender().getId().equals(userId)) {
            throw new ApiException(HttpStatus.FORBIDDEN,
                    "You can only delete your own messages for everyone.");
        }
        if (message.isDeleted()) {
            return; // already deleted; nothing to do
        }
        if (Duration.between(message.getCreatedAt(), Instant.now())
                .compareTo(DELETE_FOR_EVERYONE_WINDOW) > 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "This message is too old to delete for everyone.");
        }

        message.setDeleted(true);
        message.setContent(null);   // wipe the text
        message.setMediaUrl(null);  // wipe any media reference
        messageRepository.save(message);

        broadcastDeleted(message);
    }

    /**
     * Edit a message's text. Sender only, own TEXT messages only, within the
     * 30-minute window. Read status does not matter (WhatsApp-style). Sets
     * `edited`=true, updates content, then broadcasts so every open client
     * updates the bubble in place.
     */
    @Transactional
    public void editMessage(Long userId, Long messageId, String newContent) {
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Message not found."));

        if (!message.getSender().getId().equals(userId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "You can only edit your own messages.");
        }
        if (message.isDeleted()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "You cannot edit a deleted message.");
        }
        if (message.getType() != MessageType.TEXT) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Only text messages can be edited.");
        }
        if (newContent == null || newContent.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Edited message cannot be empty.");
        }
        if (Duration.between(message.getCreatedAt(), Instant.now())
                .compareTo(EDIT_WINDOW) > 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "This message is too old to edit.");
        }

        message.setContent(newContent.trim());
        message.setEdited(true);
        messageRepository.save(message);

        broadcastEdited(message);
    }

    private void broadcastDeleted(Message message) {
        String conversationId = message.getConversationId();
        MessageDeletedEvent event = new MessageDeletedEvent(message.getId(), conversationId);

        if (ConversationUtil.isDirect(conversationId)) {
            long[] p = ConversationUtil.dmParticipants(conversationId);
            send(p[0], event);
            send(p[1], event);
        } else if (ConversationUtil.isGroup(conversationId)) {
            Long groupId = ConversationUtil.groupIdFrom(conversationId);
            for (GroupMember member : groupMemberRepository.findByGroupId(groupId)) {
                send(member.getUser().getId(), event);
            }
        }
    }

    private void send(Long recipientId, MessageDeletedEvent event) {
        messagingTemplate.convertAndSendToUser(recipientId.toString(), DELETED_QUEUE, event);
    }

    private void ensureMember(Long userId, String conversationId) {
        if (ConversationUtil.isDirect(conversationId)) {
            long[] p = ConversationUtil.dmParticipants(conversationId);
            if (userId != p[0] && userId != p[1]) {
                throw new ApiException(HttpStatus.FORBIDDEN, "You are not part of this conversation.");
            }
        } else if (ConversationUtil.isGroup(conversationId)) {
            Long groupId = ConversationUtil.groupIdFrom(conversationId);
            if (!groupMemberRepository.existsByGroupIdAndUserId(groupId, userId)) {
                throw new ApiException(HttpStatus.FORBIDDEN, "You are not a member of this group.");
            }
        }
    }

    private void broadcastEdited(Message message) {
        String conversationId = message.getConversationId();
        MessageEditedEvent event = new MessageEditedEvent(
                message.getId(), conversationId, message.getContent());

        if (ConversationUtil.isDirect(conversationId)) {
            long[] p = ConversationUtil.dmParticipants(conversationId);
            messagingTemplate.convertAndSendToUser(String.valueOf(p[0]), EDITED_QUEUE, event);
            messagingTemplate.convertAndSendToUser(String.valueOf(p[1]), EDITED_QUEUE, event);
        } else if (ConversationUtil.isGroup(conversationId)) {
            Long groupId = ConversationUtil.groupIdFrom(conversationId);
            for (GroupMember member : groupMemberRepository.findByGroupId(groupId)) {
                messagingTemplate.convertAndSendToUser(
                        String.valueOf(member.getUser().getId()), EDITED_QUEUE, event);
            }
        }
    }
}