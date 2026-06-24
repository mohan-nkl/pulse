package com.mohan.pulse.services;

import com.mohan.pulse.dtos.ChatMessageResponse;
import com.mohan.pulse.dtos.SendGroupMessageRequest;
import com.mohan.pulse.dtos.SendMessageRequest;
import com.mohan.pulse.exceptions.ApiException;
import com.mohan.pulse.models.ConversationType;
import com.mohan.pulse.models.GroupMember;
import com.mohan.pulse.models.Message;
import com.mohan.pulse.models.MessageType;
import com.mohan.pulse.models.User;
import com.mohan.pulse.repositories.GroupMemberRepository;
import com.mohan.pulse.repositories.MessageRepository;
import com.mohan.pulse.repositories.UserRepository;
import com.mohan.pulse.utils.ConversationUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ChatService {

    private static final String USER_QUEUE = "/queue/messages";

    private final UserRepository userRepository;
    private final MessageRepository messageRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final MessageStatusService messageStatusService;
    private final NotificationService notificationService;

    @Transactional
    public ChatMessageResponse sendDirectMessage(Long senderId, SendMessageRequest request) {

        if (request.getReceiverId() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Receiver id is required");
        }
        validateContent(request.getMessageType(), request.getContent(), request.getMediaUrl());

        User sender   = findUser(senderId,                "Sender not found");
        User receiver = findUser(request.getReceiverId(), "Receiver not found");

        if (sender.getId().equals(receiver.getId())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "You cannot message yourself");
        }

        String conversationId = ConversationUtil.dmConversationId(sender.getId(), receiver.getId());

        Message message = new Message();
        message.setConversationId(conversationId);
        message.setConversationType(ConversationType.DIRECT);
        message.setSender(sender);
        message.setType(parseMessageType(request.getMessageType())); // TEXT, IMAGE, etc.
        message.setContent(request.getContent());
        message.setMediaUrl(request.getMediaUrl());                  // null for text messages

        Message saved = messageRepository.save(message);
        messageStatusService.createRecipientStatuses(saved, List.of(receiver.getId()));

        ChatMessageResponse response = toResponse(saved, sender.getId(), conversationId);

        messagingTemplate.convertAndSendToUser(receiver.getId().toString(), USER_QUEUE, response);
        messagingTemplate.convertAndSendToUser(sender.getId().toString(),   USER_QUEUE, response);

        notificationService.sendNotification(receiver.getId(), conversationId, sender.getName(), request.getContent());

        return response;
    }

    @Transactional
    public ChatMessageResponse sendGroupMessage(Long senderId, SendGroupMessageRequest request) {

        if (request.getGroupId() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Group id is required");
        }
        validateContent(request.getMessageType(), request.getContent(), request.getMediaUrl());

        User sender = findUser(senderId, "Sender not found");

        if (!groupMemberRepository.existsByGroupIdAndUserId(request.getGroupId(), senderId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "You are not a member of this group.");
        }

        String conversationId = ConversationUtil.groupConversationId(request.getGroupId());

        Message message = new Message();
        message.setConversationId(conversationId);
        message.setConversationType(ConversationType.GROUP);
        message.setSender(sender);
        message.setType(parseMessageType(request.getMessageType()));
        message.setContent(request.getContent());
        message.setMediaUrl(request.getMediaUrl());

        Message saved = messageRepository.save(message);

        List<GroupMember> members    = groupMemberRepository.findByGroupId(request.getGroupId());
        List<Long>        recipients = members.stream()
                .map(m -> m.getUser().getId())
                .filter(id -> !id.equals(senderId))
                .toList();

        messageStatusService.createRecipientStatuses(saved, recipients);

        ChatMessageResponse response = toResponse(saved, sender.getId(), conversationId);

        for (GroupMember member : members) {
            messagingTemplate.convertAndSendToUser(
                    member.getUser().getId().toString(), USER_QUEUE, response);
        }

        for (Long recipientId : recipients) {
            notificationService.sendNotification(recipientId, conversationId, sender.getName(), request.getContent());
        }

        return response;
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    /**
     * TEXT messages must have content.
     * Media messages must have a mediaUrl (caption/content is optional).
     */
    private void validateContent(String messageType, String content, String mediaUrl) {
        boolean isText = messageType == null || messageType.equals("TEXT");

        if (isText && (content == null || content.isBlank())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Message content must not be empty");
        }
        if (!isText && (mediaUrl == null || mediaUrl.isBlank())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Media URL is required for media messages");
        }
    }

    /**
     * Safely turns "IMAGE", "VIDEO" etc. into the MessageType enum.
     * Falls back to TEXT if the value is null or unrecognised.
     */
    private MessageType parseMessageType(String messageType) {
        if (messageType == null) return MessageType.TEXT;
        try {
            return MessageType.valueOf(messageType);
        } catch (IllegalArgumentException e) {
            return MessageType.TEXT;
        }
    }

    private ChatMessageResponse toResponse(Message saved, Long senderId, String conversationId) {
        return new ChatMessageResponse(
                saved.getId(),
                conversationId,
                senderId,
                saved.getContent(),
                saved.getCreatedAt(),
                saved.getType().name(),  // "TEXT", "IMAGE", etc.
                saved.getMediaUrl()      // null for text, URL for media
        );
    }

    private User findUser(Long id, String notFoundMessage) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, notFoundMessage));
    }
}