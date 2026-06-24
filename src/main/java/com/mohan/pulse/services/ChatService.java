package com.mohan.pulse.services;

import com.mohan.pulse.dtos.ChatMessageResponse;
import com.mohan.pulse.dtos.ReplySummary;
import com.mohan.pulse.dtos.SendGroupMessageRequest;
import com.mohan.pulse.dtos.SendMessageRequest;
import com.mohan.pulse.dtos.StatusPreviewDto;
import com.mohan.pulse.exceptions.ApiException;
import com.mohan.pulse.models.ConversationType;
import com.mohan.pulse.group.GroupMember;
import com.mohan.pulse.models.Message;
import com.mohan.pulse.models.MessageType;
import com.mohan.pulse.models.User;
import com.mohan.pulse.group.GroupMemberRepository;
import com.mohan.pulse.notification.NotificationService;
import com.mohan.pulse.repositories.MessageRepository;
import com.mohan.pulse.repositories.StatusRepository;
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
    private final StatusRepository statusRepository;
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
        message.setType(parseMessageType(request.getMessageType()));
        message.setContent(request.getContent());
        message.setMediaUrl(request.getMediaUrl());
        message.setReplyTo(resolveReplyTo(request.getReplyToId(), conversationId));

        // Attach status reference if this is a status reply
        if (request.getReplyToStatusId() != null) {
            message.setReplyToStatusId(request.getReplyToStatusId());
        }

        Message saved = messageRepository.save(message);
        messageStatusService.createRecipientStatuses(saved, List.of(receiver.getId()));

        ChatMessageResponse response = toResponse(saved, sender.getId(), conversationId,
                buildStatusPreview(request.getReplyToStatusId()));

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
        message.setReplyTo(resolveReplyTo(request.getReplyToId(), conversationId));

        Message saved = messageRepository.save(message);

        List<GroupMember> members    = groupMemberRepository.findByGroupId(request.getGroupId());
        List<Long>        recipients = members.stream()
                .map(m -> m.getUser().getId())
                .filter(id -> !id.equals(senderId))
                .toList();

        messageStatusService.createRecipientStatuses(saved, recipients);

        ChatMessageResponse response = toResponse(saved, sender.getId(), conversationId, null);

        for (GroupMember member : members) {
            messagingTemplate.convertAndSendToUser(
                    member.getUser().getId().toString(), USER_QUEUE, response);
        }

        for (Long recipientId : recipients) {
            notificationService.sendNotification(recipientId, conversationId, sender.getName(), request.getContent());
        }

        return response;
    }

    private void validateContent(String messageType, String content, String mediaUrl) {
        boolean isText = messageType == null || messageType.equals("TEXT");

        if (isText && (content == null || content.isBlank())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Message content must not be empty");
        }
        if (!isText && (mediaUrl == null || mediaUrl.isBlank())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Media URL is required for media messages");
        }
    }

    private Message resolveReplyTo(Long replyToId, String conversationId) {
        if (replyToId == null) {
            return null;
        }
        Message original = messageRepository.findById(replyToId)
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST,
                        "The message you are replying to does not exist."));
        if (!original.getConversationId().equals(conversationId)) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "You can only reply to messages in the same conversation.");
        }
        return original;
    }

    private MessageType parseMessageType(String messageType) {
        if (messageType == null) return MessageType.TEXT;
        try {
            return MessageType.valueOf(messageType);
        } catch (IllegalArgumentException e) {
            return MessageType.TEXT;
        }
    }

    private ChatMessageResponse toResponse(Message saved, Long senderId, String conversationId,
                                           StatusPreviewDto statusPreview) {
        ReplySummary reply = ReplySummary.from(saved.getReplyTo());
        return new ChatMessageResponse(
                saved.getId(),
                conversationId,
                senderId,
                saved.getContent(),
                saved.getCreatedAt(),
                saved.getType().name(),
                saved.getMediaUrl(),
                reply.replyToId(),
                reply.replyToSenderId(),
                reply.replyToSenderName(),
                reply.replyToContent(),
                reply.replyToType(),
                reply.replyToDeleted(),
                statusPreview,
                saved.isEdited(),    // false for a brand-new message
                saved.isDeleted()    // false for a brand-new message
        );
    }

    private User findUser(Long id, String notFoundMessage) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, notFoundMessage));
    }

    private StatusPreviewDto buildStatusPreview(Long statusId) {
        if (statusId == null) return null;
        return statusRepository.findById(statusId)
                .map(s -> StatusPreviewDto.builder()
                        .authorName(s.getAuthor().getName())
                        .content(s.getContent())
                        .mediaUrl(s.getMediaUrl())
                        .build())
                .orElse(null);
    }
}