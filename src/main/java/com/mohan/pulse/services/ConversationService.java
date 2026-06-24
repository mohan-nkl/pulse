package com.mohan.pulse.services;

import com.mohan.pulse.dtos.MessageResponse;
import com.mohan.pulse.dtos.MessageStatusUpdate;
import com.mohan.pulse.dtos.PagedMessages;
import com.mohan.pulse.dtos.ReactionEntry;
import com.mohan.pulse.dtos.ReplySummary;
import com.mohan.pulse.dtos.StatusPreviewDto;
import com.mohan.pulse.exceptions.ApiException;
import com.mohan.pulse.models.Message;
import com.mohan.pulse.models.MessageStatus;
import com.mohan.pulse.models.Status;
import com.mohan.pulse.repositories.DeletedMessageRepository;
import com.mohan.pulse.group.GroupMemberRepository;
import com.mohan.pulse.repositories.MessageRecipientStatusRepository;
import com.mohan.pulse.repositories.MessageRepository;
import com.mohan.pulse.repositories.StatusRepository;
import com.mohan.pulse.utils.ConversationUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ConversationService {

    private static final int DEFAULT_LIMIT = 30;

    private final MessageRepository messageRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final MessageStatusService messageStatusService;
    private final StatusRepository statusRepository;
    private final ReactionService reactionService;
    private final MessageRecipientStatusRepository recipientStatusRepository;
    private final DeletedMessageRepository deletedMessageRepository;

    // ── Direct message conversation (paginated) ───────────────────────────────

    public PagedMessages getDirectConversation(Long currentUserId,
                                               Long otherUserId,
                                               Long beforeId,
                                               int limit) {
        String conversationId = ConversationUtil.dmConversationId(currentUserId, otherUserId);
        return fetchPage(conversationId, beforeId, limit, currentUserId);
    }

    // ── Group conversation (paginated) ────────────────────────────────────────

    public PagedMessages getGroupConversation(Long currentUserId,
                                              Long groupId,
                                              Long beforeId,
                                              int limit) {
        if (!groupMemberRepository.existsByGroupIdAndUserId(groupId, currentUserId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "You are not a member of this group.");
        }
        String conversationId = ConversationUtil.groupConversationId(groupId);
        return fetchPage(conversationId, beforeId, limit, currentUserId);
    }

    // ── Unread counts across all conversations ────────────────────────────────
    // Returns conversationId → number of unread messages, for the chat-list badges.

    public Map<String, Integer> getUnreadCounts(Long userId) {
        return recipientStatusRepository
                .countUnreadPerConversation(userId)
                .stream()
                .collect(Collectors.toMap(
                        row -> (String) row[0],            // conversationId
                        row -> ((Long) row[1]).intValue()  // count
                ));
    }

    // ── Core paging logic ─────────────────────────────────────────────────────

    private PagedMessages fetchPage(String conversationId, Long beforeId, int limit, Long currentUserId) {
        var pageable = PageRequest.of(0, limit);

        // Fetch DESC (newest first within the batch) so LIMIT grabs the right end.
        List<Message> raw = (beforeId == null)
                ? messageRepository.findByConversationIdOrderByCreatedAtDesc(
                conversationId, pageable)
                : messageRepository.findByConversationIdAndIdLessThanOrderByCreatedAtDesc(
                conversationId, beforeId, pageable);

        // Reverse to chronological (oldest→newest) before mapping to responses.
        List<Message> messages = new ArrayList<>(raw);
        Collections.reverse(messages);

        // hasMore: a full batch means there may be older messages to load.
        boolean hasMore = raw.size() == limit;

        return new PagedMessages(toResponses(messages, currentUserId), hasMore);
    }

    // ── Map Message entities → MessageResponse DTOs ───────────────────────────

    private List<MessageResponse> toResponses(List<Message> messages, Long currentUserId) {
        if (messages.isEmpty()) return List.of();

        List<Long> messageIds = messages.stream().map(Message::getId).toList();

        // Which of these did the current user delete-for-me? Filter them out.
        Set<Long> hiddenForMe = deletedMessageRepository
                .findByUser_IdAndMessage_IdIn(currentUserId, messageIds).stream()
                .map(dm -> dm.getMessage().getId())
                .collect(Collectors.toSet());

        Map<Long, MessageStatusUpdate> statusById =
                messageStatusService.statusForMessages(messageIds);
        Map<Long, List<ReactionEntry>> reactionsById =
                reactionService.reactionsForMessages(messageIds);

        // Batch-fetch any statuses that were replied to
        Set<Long> statusIds = messages.stream()
                .map(Message::getReplyToStatusId)
                .filter(id -> id != null)
                .collect(Collectors.toSet());

        Map<Long, Status> statusesById = statusRepository.findAllById(statusIds)
                .stream()
                .collect(Collectors.toMap(Status::getId, s -> s));

        return messages.stream()
                .filter(message -> !hiddenForMe.contains(message.getId())) // drop delete-for-me
                .map(message -> {
                    MessageStatusUpdate s = statusById.get(message.getId());
                    ReplySummary reply = ReplySummary.from(message.getReplyTo());

                    StatusPreviewDto preview = null;
                    if (message.getReplyToStatusId() != null) {
                        Status status = statusesById.get(message.getReplyToStatusId());
                        if (status != null) {
                            preview = StatusPreviewDto.builder()
                                    .authorName(status.getAuthor().getName())
                                    .content(status.getContent())
                                    .mediaUrl(status.getMediaUrl())
                                    .build();
                        }
                    }

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
                            reactionsById.getOrDefault(message.getId(), List.of()),
                            preview,
                            message.isEdited(),
                            message.isDeleted());
                })
                .toList();
    }
}