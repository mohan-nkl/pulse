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
import com.mohan.pulse.repositories.GroupMemberRepository;
import com.mohan.pulse.repositories.MessageRecipientStatusRepository;
import com.mohan.pulse.repositories.MessageRepository;
import com.mohan.pulse.repositories.StatusRepository;
import com.mohan.pulse.utils.ConversationUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
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

    // ── Direct message conversation ───────────────────────────────────────────

    public PagedMessages getDirectConversation(Long currentUserId,
                                               Long otherUserId,
                                               Long beforeId,
                                               int limit) {
        String conversationId = ConversationUtil.dmConversationId(currentUserId, otherUserId);
        return fetchPage(conversationId, beforeId, limit);
    }

    // ── Group conversation ────────────────────────────────────────────────────

    public PagedMessages getGroupConversation(Long currentUserId,
                                              Long groupId,
                                              Long beforeId,
                                              int limit) {
        if (!groupMemberRepository.existsByGroupIdAndUserId(groupId, currentUserId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "You are not a member of this group.");
        }
        String conversationId = ConversationUtil.groupConversationId(groupId);
        return fetchPage(conversationId, beforeId, limit);
    }

    // ── Unread counts across all conversations ────────────────────────────────
    // Returns a map of conversationId → number of unread messages.
    // Frontend uses this to show the number badge on each chat row.

    public Map<String, Integer> getUnreadCounts(Long userId) {
        return recipientStatusRepository
                .countUnreadPerConversation(userId)
                .stream()
                .collect(Collectors.toMap(
                        row -> (String) row[0],         // conversationId
                        row -> ((Long) row[1]).intValue() // count
                ));
    }

    // ── Core paging logic ─────────────────────────────────────────────────────

    private PagedMessages fetchPage(String conversationId, Long beforeId, int limit) {
        var pageable = PageRequest.of(0, limit);

        // Fetch DESC (newest first within the batch) so LIMIT grabs the right end.
        List<Message> raw = (beforeId == null)
                ? messageRepository.findByConversationIdOrderByCreatedAtDesc(
                conversationId, pageable)
                : messageRepository.findByConversationIdAndIdLessThanOrderByCreatedAtDesc(
                conversationId, beforeId, pageable);

        // Reverse to chronological (oldest→newest) before mapping to responses.
        List<Message> messages = new ArrayList<>(raw);
        java.util.Collections.reverse(messages);

        // hasMore: if we got a full batch there might be older messages to load.
        boolean hasMore = raw.size() == limit;

        return new PagedMessages(toResponses(messages), hasMore);
    }

    // ── Map Message entities → MessageResponse DTOs ───────────────────────────

    private List<MessageResponse> toResponses(List<Message> messages) {
        if (messages.isEmpty()) return List.of();

        List<Long> messageIds = messages.stream().map(Message::getId).toList();
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
                            preview);
                })
                .toList();
    }
}