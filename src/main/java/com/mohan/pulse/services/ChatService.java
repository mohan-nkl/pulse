package com.mohan.pulse.services;

import com.mohan.pulse.dtos.ChatMessageResponse;
import com.mohan.pulse.dtos.SendGroupMessageRequest;
import com.mohan.pulse.dtos.SendMessageRequest;
import com.mohan.pulse.dtos.StatusPreviewDto;
import com.mohan.pulse.exceptions.ApiException;
import com.mohan.pulse.models.ConversationType;
import com.mohan.pulse.models.GroupMember;
import com.mohan.pulse.models.Message;
import com.mohan.pulse.models.MessageType;
import com.mohan.pulse.models.User;
import com.mohan.pulse.repositories.GroupMemberRepository;
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

    @Transactional
    public ChatMessageResponse sendDirectMessage(Long senderId, SendMessageRequest request) {

        validateDirect(request);

        User sender = findUser(senderId, "Sender not found");
        User receiver = findUser(request.getReceiverId(), "Receiver not found");

        if (sender.getId().equals(receiver.getId())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "You cannot message yourself");
        }

        String conversationId =
                ConversationUtil.dmConversationId(sender.getId(), receiver.getId());

        Message message = new Message();
        message.setConversationId(conversationId);
        message.setConversationType(ConversationType.DIRECT);
        message.setSender(sender);
        message.setType(MessageType.TEXT);
        message.setContent(request.getContent());

        // Attach status reference if this is a status reply
        if (request.getReplyToStatusId() != null) {
            message.setReplyToStatusId(request.getReplyToStatusId());
        }

        Message saved = messageRepository.save(message);

        messageStatusService.createRecipientStatuses(saved, List.of(receiver.getId()));

        // Build a status preview to include in the response (null for regular messages)
        StatusPreviewDto statusPreview = buildStatusPreview(request.getReplyToStatusId());

        ChatMessageResponse response = new ChatMessageResponse(
                saved.getId(),
                saved.getConversationId(),
                sender.getId(),
                saved.getContent(),
                saved.getCreatedAt(),
                statusPreview);

        messagingTemplate.convertAndSendToUser(receiver.getId().toString(), USER_QUEUE, response);
        messagingTemplate.convertAndSendToUser(sender.getId().toString(), USER_QUEUE, response);

        return response;
    }

    @Transactional
    public ChatMessageResponse sendGroupMessage(Long senderId, SendGroupMessageRequest request) {

        validateGroup(request);

        User sender = findUser(senderId, "Sender not found");

        if (!groupMemberRepository.existsByGroupIdAndUserId(request.getGroupId(), senderId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "You are not a member of this group.");
        }

        String conversationId = ConversationUtil.groupConversationId(request.getGroupId());

        Message message = new Message();
        message.setConversationId(conversationId);
        message.setConversationType(ConversationType.GROUP);
        message.setSender(sender);
        message.setType(MessageType.TEXT);
        message.setContent(request.getContent());

        Message saved = messageRepository.save(message);

        List<GroupMember> members = groupMemberRepository.findByGroupId(request.getGroupId());

        List<Long> recipientIds = members.stream()
                .map(member -> member.getUser().getId())
                .filter(userId -> !userId.equals(senderId))
                .toList();
        messageStatusService.createRecipientStatuses(saved, recipientIds);

        ChatMessageResponse response = new ChatMessageResponse(
                saved.getId(),
                saved.getConversationId(),
                sender.getId(),
                saved.getContent(),
                saved.getCreatedAt());

        for (GroupMember member : members) {
            messagingTemplate.convertAndSendToUser(
                    member.getUser().getId().toString(), USER_QUEUE, response);
        }

        return response;
    }

    private void validateDirect(SendMessageRequest request) {
        if (request.getReceiverId() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Receiver id is required");
        }
        if (request.getContent() == null || request.getContent().isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Message content must not be empty");
        }
    }

    private void validateGroup(SendGroupMessageRequest request) {
        if (request.getGroupId() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Group id is required");
        }
        if (request.getContent() == null || request.getContent().isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Message content must not be empty");
        }
    }

    private User findUser(Long id, String notFoundMessage) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, notFoundMessage));
    }

    // Looks up the status and returns a compact preview, or null if deleted/not found.
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