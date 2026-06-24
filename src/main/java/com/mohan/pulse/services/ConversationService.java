package com.mohan.pulse.services;

import com.mohan.pulse.dtos.MessageResponse;
import com.mohan.pulse.dtos.MessageStatusUpdate;
import com.mohan.pulse.dtos.ReactionEntry;
import com.mohan.pulse.dtos.ReplySummary;
import com.mohan.pulse.exceptions.ApiException;
import com.mohan.pulse.models.Message;
import com.mohan.pulse.models.MessageStatus;
import com.mohan.pulse.repositories.GroupMemberRepository;
import com.mohan.pulse.repositories.MessageRepository;
import com.mohan.pulse.utils.ConversationUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ConversationService {

    private final MessageRepository messageRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final MessageStatusService messageStatusService;
    private final ReactionService reactionService;

    public List<MessageResponse> getDirectConversation(Long currentUserId, Long otherUserId) {

        String conversationId =
                ConversationUtil.dmConversationId(currentUserId, otherUserId);

        List<Message> messages = messageRepository
                .findByConversationIdOrderByCreatedAtAsc(conversationId);

        return toResponses(messages);
    }

    public List<MessageResponse> getGroupConversation(Long currentUserId, Long groupId) {

        if (!groupMemberRepository.existsByGroupIdAndUserId(groupId, currentUserId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "You are not a member of this group.");
        }

        String conversationId = ConversationUtil.groupConversationId(groupId);

        List<Message> messages = messageRepository
                .findByConversationIdOrderByCreatedAtAsc(conversationId);

        return toResponses(messages);
    }


    private List<MessageResponse> toResponses(List<Message> messages) {

        List<Long> messageIds = messages.stream().map(Message::getId).toList();
        Map<Long, MessageStatusUpdate> statusById =
                messageStatusService.statusForMessages(messageIds);
        Map<Long, List<ReactionEntry>> reactionsById =
                reactionService.reactionsForMessages(messageIds);

        return messages.stream()
                .map(message -> {
                    MessageStatusUpdate s = statusById.get(message.getId());
                    ReplySummary reply = ReplySummary.from(message.getReplyTo());
                    return new MessageResponse(
                            message.getId(),
                            message.getSender().getId(),
                            message.getContent(),
                            message.getCreatedAt(),
                            s != null ? s.getStatus() : MessageStatus.SENT,
                            s != null ? s.getDeliveredCount() : 0,
                            s != null ? s.getReadCount() : 0,
                            s != null ? s.getTotalRecipients() : 0,
                            message.getType().name(),
                            message.getMediaUrl(),
                            reply.replyToId(),
                            reply.replyToSenderId(),
                            reply.replyToSenderName(),
                            reply.replyToContent(),
                            reply.replyToType(),
                            reply.replyToDeleted(),
                            reactionsById.getOrDefault(message.getId(), List.of()));
                })
                .toList();
    }
}