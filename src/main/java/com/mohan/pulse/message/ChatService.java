package com.mohan.pulse.message;

import com.mohan.pulse.block.BlockService;
import com.mohan.pulse.common.ApiException;
import com.mohan.pulse.common.ConversationUtil;
import com.mohan.pulse.contact.ContactRepository;
import com.mohan.pulse.group.GroupMember;
import com.mohan.pulse.group.GroupMemberRepository;
import com.mohan.pulse.message.dtos.ChatMessageResponse;
import com.mohan.pulse.message.dtos.ReplySummary;
import com.mohan.pulse.message.dtos.SendGroupMessageRequest;
import com.mohan.pulse.message.dtos.SendMessageRequest;
import com.mohan.pulse.notification.NotificationService;
import com.mohan.pulse.status.Status;
import com.mohan.pulse.status.StatusRepository;
import com.mohan.pulse.status.dtos.StatusPreviewDto;
import com.mohan.pulse.storage.StorageService;
import com.mohan.pulse.user.User;
import com.mohan.pulse.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ChatService {

    private static final String USER_QUEUE = "/queue/messages";

    private final UserRepository userRepository;
    private final MessageRepository messageRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final ContactRepository contactRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final MessageStatusService messageStatusService;
    private final StatusRepository statusRepository;
    private final NotificationService notificationService;
    private final StorageService storageService;
    private final BlockService blockService;

    @Transactional
    public ChatMessageResponse sendDirectMessage(Long senderId, SendMessageRequest request) {
        if (request.getReceiverId() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Receiver id is required");
        }
        validateContent(request.getMessageType(), request.getContent(), request.getMediaUrl());

        User sender = findUser(senderId, "Sender not found");
        User receiver = findUser(request.getReceiverId(), "Receiver not found");

        boolean messagingYourself = sender.getId().equals(receiver.getId());
        if (messagingYourself) {
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
        if (request.getReplyToStatusId() != null) {
            message.setReplyToStatusId(request.getReplyToStatusId());
        }

        Message saved = messageRepository.save(message);

        boolean blocked = blockService.isBlockedBetween(sender.getId(), receiver.getId());
        if (!blocked) {
            messageStatusService.createRecipientStatuses(saved, List.of(receiver.getId()));
        }

        StatusPreviewDto statusPreview = buildStatusPreview(request.getReplyToStatusId());
        MessageStatus status = messageStatusService.currentStatus(saved.getId());
        ChatMessageResponse response =
                toResponse(saved, sender.getId(), conversationId, statusPreview, status.name());

        if (!blocked) {
            sendTo(receiver.getId(), response);

            String notificationName = notificationNameFor(receiver.getId(), sender);
            notificationService.sendNotification(
                    receiver.getId(), conversationId, notificationName, request.getContent());
        }

        sendTo(sender.getId(), response);

        return response;
    }

    @Transactional
    public ChatMessageResponse sendGroupMessage(Long senderId, SendGroupMessageRequest request) {
        if (request.getGroupId() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Group id is required");
        }
        validateContent(request.getMessageType(), request.getContent(), request.getMediaUrl());

        User sender = findUser(senderId, "Sender not found");

        boolean isMember = groupMemberRepository.existsByGroupIdAndUserId(request.getGroupId(), senderId);
        if (!isMember) {
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

        List<GroupMember> members = groupMemberRepository.findByGroupId(request.getGroupId());
        List<Long> recipientIds = deliverableRecipientIds(members, senderId);

        messageStatusService.createRecipientStatuses(saved, recipientIds);

        MessageStatus status = messageStatusService.currentStatus(saved.getId());
        ChatMessageResponse response =
                toResponse(saved, sender.getId(), conversationId, null, status.name());

        String groupName = members.get(0).getGroup().getName();
        for (Long recipientId : recipientIds) {
            sendTo(recipientId, response);

            String senderLabel = notificationNameFor(recipientId, sender);
            notificationService.sendGroupNotification(
                    recipientId, conversationId, groupName, senderLabel, request.getContent());
        }

        sendTo(sender.getId(), response);

        return response;
    }

    private List<Long> deliverableRecipientIds(List<GroupMember> members, Long senderId) {
        List<Long> recipientIds = new ArrayList<>();
        for (GroupMember member : members) {
            Long memberId = member.getUser().getId();

            boolean isSender = memberId.equals(senderId);
            if (isSender) {
                continue;
            }

            boolean blocked = blockService.isBlockedBetween(senderId, memberId);
            if (blocked) {
                continue;
            }

            recipientIds.add(memberId);
        }
        return recipientIds;
    }

    private void validateContent(String messageType, String content, String mediaUrl) {
        boolean isText = (messageType == null || messageType.equals("TEXT"));

        if (isText) {
            boolean contentMissing = (content == null || content.isBlank());
            if (contentMissing) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Message content must not be empty");
            }
        } else {
            boolean mediaUrlMissing = (mediaUrl == null || mediaUrl.isBlank());
            if (mediaUrlMissing) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Media URL is required for media messages");
            }
        }
    }

    private Message resolveReplyTo(Long replyToId, String conversationId) {
        if (replyToId == null) {
            return null;
        }

        Optional<Message> maybeOriginal = messageRepository.findById(replyToId);
        if (maybeOriginal.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "The message you are replying to does not exist.");
        }
        Message original = maybeOriginal.get();

        boolean differentConversation = !original.getConversationId().equals(conversationId);
        if (differentConversation) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "You can only reply to messages in the same conversation.");
        }
        return original;
    }

    private MessageType parseMessageType(String messageType) {
        if (messageType == null) {
            return MessageType.TEXT;
        }
        try {
            return MessageType.valueOf(messageType);
        } catch (IllegalArgumentException e) {
            return MessageType.TEXT;
        }
    }

    private ChatMessageResponse toResponse(Message saved, Long senderId, String conversationId,
                                           StatusPreviewDto statusPreview, String status) {
        ReplySummary reply = ReplySummary.from(saved.getReplyTo());
        String mediaUrl = storageService.presignedUrl(saved.getMediaUrl());

        return ChatMessageResponse.builder()
                .id(saved.getId())
                .conversationId(conversationId)
                .senderId(senderId)
                .content(saved.getContent())
                .createdAt(saved.getCreatedAt())
                .status(status)
                .type(saved.getType().name())
                .mediaUrl(mediaUrl)
                .replyToId(reply.getReplyToId())
                .replyToSenderId(reply.getReplyToSenderId())
                .replyToSenderName(reply.getReplyToSenderName())
                .replyToContent(reply.getReplyToContent())
                .replyToType(reply.getReplyToType())
                .replyToDeleted(reply.isReplyToDeleted())
                .statusPreview(statusPreview)
                .edited(saved.isEdited())
                .deleted(saved.isDeleted())
                .callStatus(saved.getCallStatus())
                .callMediaType(saved.getCallMediaType())
                .callDurationSec(saved.getCallDurationSec())
                .build();
    }

    private User findUser(Long id, String notFoundMessage) {
        Optional<User> maybeUser = userRepository.findById(id);
        if (maybeUser.isEmpty()) {
            throw new ApiException(HttpStatus.NOT_FOUND, notFoundMessage);
        }
        return maybeUser.get();
    }

    private StatusPreviewDto buildStatusPreview(Long statusId) {
        if (statusId == null) {
            return null;
        }

        Optional<Status> maybeStatus = statusRepository.findById(statusId);
        if (maybeStatus.isEmpty()) {
            return null;
        }

        Status status = maybeStatus.get();
        String authorName = status.getAuthor().getName();
        String content = status.getContent();
        String mediaUrl = storageService.presignedUrl(status.getMediaUrl());
        return new StatusPreviewDto(authorName, content, mediaUrl);
    }

    private void sendTo(Long userId, ChatMessageResponse response) {
        messagingTemplate.convertAndSendToUser(userId.toString(), USER_QUEUE, response);
    }

    private String notificationNameFor(Long recipientId, User sender) {
        return contactRepository.findByOwner_IdAndContact_Id(recipientId, sender.getId())
                .map(contact -> {
                    String alias = contact.getAlias();
                    return (alias != null && !alias.isBlank()) ? alias : sender.getName();
                })
                .orElseGet(sender::getPhone);
    }
}