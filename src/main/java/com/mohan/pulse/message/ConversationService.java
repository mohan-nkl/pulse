package com.mohan.pulse.message;

import com.mohan.pulse.block.BlockService;
import com.mohan.pulse.common.ApiException;
import com.mohan.pulse.common.ConversationUtil;
import com.mohan.pulse.group.GroupMember;
import com.mohan.pulse.group.GroupMemberRepository;
import com.mohan.pulse.message.dtos.ConversationPartner;
import com.mohan.pulse.message.dtos.MessageResponse;
import com.mohan.pulse.message.dtos.MessageStatusUpdate;
import com.mohan.pulse.message.dtos.PagedMessages;
import com.mohan.pulse.reaction.ReactionService;
import com.mohan.pulse.reaction.dtos.ReactionEntry;
import com.mohan.pulse.message.dtos.ReplySummary;
import com.mohan.pulse.status.Status;
import com.mohan.pulse.status.StatusRepository;
import com.mohan.pulse.status.dtos.StatusPreviewDto;
import com.mohan.pulse.storage.StorageService;
import com.mohan.pulse.user.User;
import com.mohan.pulse.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class ConversationService {

    private final MessageRepository messageRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final MessageStatusService messageStatusService;
    private final StatusRepository statusRepository;
    private final ReactionService reactionService;
    private final MessageRecipientStatusRepository recipientStatusRepository;
    private final DeletedMessageRepository deletedMessageRepository;
    private final StorageService storageService;
    private final BlockService blockService;
    private final UserRepository userRepository;

    public PagedMessages getDirectConversation(Long currentUserId,
                                               Long otherUserId,
                                               Long beforeId,
                                               int limit) {
        String conversationId = ConversationUtil.dmConversationId(currentUserId, otherUserId);
        return fetchPage(conversationId, beforeId, limit, currentUserId);
    }

    public PagedMessages getGroupConversation(Long currentUserId,
                                              Long groupId,
                                              Long beforeId,
                                              int limit) {
        boolean isMember = groupMemberRepository.existsByGroupIdAndUserId(groupId, currentUserId);
        if (!isMember) {
            throw new ApiException(HttpStatus.FORBIDDEN, "You are not a member of this group.");
        }

        String conversationId = ConversationUtil.groupConversationId(groupId);
        return fetchPage(conversationId, beforeId, limit, currentUserId);
    }

    public Map<String, Integer> getUnreadCounts(Long userId) {
        List<Object[]> rows = recipientStatusRepository.countUnreadPerConversation(userId);

        Map<String, Integer> unreadByConversation = new HashMap<>();
        for (Object[] row : rows) {
            String conversationId = (String) row[0];
            int count = ((Long) row[1]).intValue();
            unreadByConversation.put(conversationId, count);
        }
        return unreadByConversation;
    }

    public List<ConversationPartner> getPartners(Long currentUserId) {
        Set<String> conversationIds = new HashSet<>();
        conversationIds.addAll(messageRepository.findDirectConversationIdsBySender(currentUserId));
        conversationIds.addAll(recipientStatusRepository.findDirectConversationIdsForRecipient(currentUserId));

        Set<Long> partnerIds = new HashSet<>();
        for (String conversationId : conversationIds) {
            long[] participants = ConversationUtil.dmParticipants(conversationId);

            long otherUserId;
            if (participants[0] == currentUserId) {
                otherUserId = participants[1];
            } else {
                otherUserId = participants[0];
            }
            partnerIds.add(otherUserId);
        }

        List<ConversationPartner> partners = new ArrayList<>();
        for (User user : userRepository.findAllById(partnerIds)) {
            String avatarUrl = storageService.presignedUrl(user.getAvatarUrl());
            partners.add(new ConversationPartner(
                    user.getId(), user.getName(), user.getPhone(), avatarUrl, user.getLastSeen()));
        }
        return partners;
    }

    public Map<String, Instant> getConversationSummaries(Long currentUserId) {
        Set<String> conversationIds = new HashSet<>();
        conversationIds.addAll(messageRepository.findDirectConversationIdsBySender(currentUserId));
        conversationIds.addAll(recipientStatusRepository.findDirectConversationIdsForRecipient(currentUserId));

        for (GroupMember membership : groupMemberRepository.findByUserId(currentUserId)) {
            Long groupId = membership.getGroup().getId();
            conversationIds.add(ConversationUtil.groupConversationId(groupId));
        }

        Map<String, Instant> lastMessageByConversation = new HashMap<>();
        if (conversationIds.isEmpty()) {
            return lastMessageByConversation;
        }

        for (Object[] row : messageRepository.findLastMessageTimes(conversationIds)) {
            String conversationId = (String) row[0];
            Instant lastMessageAt = (Instant) row[1];
            lastMessageByConversation.put(conversationId, lastMessageAt);
        }
        return lastMessageByConversation;
    }

    private PagedMessages fetchPage(String conversationId, Long beforeId, int limit, Long currentUserId) {
        PageRequest pageRequest = PageRequest.of(0, limit);

        List<Message> newestFirst;
        if (beforeId == null) {
            newestFirst = messageRepository
                    .findByConversationIdOrderByCreatedAtDesc(conversationId, pageRequest);
        } else {
            newestFirst = messageRepository
                    .findByConversationIdAndIdLessThanOrderByCreatedAtDesc(conversationId, beforeId, pageRequest);
        }

        boolean hasMore = (newestFirst.size() == limit);

        List<Message> oldestFirst = new ArrayList<>(newestFirst);
        Collections.reverse(oldestFirst);

        List<MessageResponse> responses = toResponses(oldestFirst, currentUserId);
        return new PagedMessages(responses, hasMore);
    }

    private List<MessageResponse> toResponses(List<Message> messages, Long currentUserId) {
        if (messages.isEmpty()) {
            return List.of();
        }

        List<Long> messageIds = collectIds(messages);

        Set<Long> hiddenMessageIds = hiddenMessageIdsFor(currentUserId, messageIds);
        Set<Long> blockedAuthorIds = new HashSet<>(blockService.blockedIdsOf(currentUserId));

        Map<Long, MessageStatusUpdate> statusByMessageId = messageStatusService.statusForMessages(messageIds);
        Map<Long, List<ReactionEntry>> reactionsByMessageId = reactionService.reactionsForMessages(messageIds);
        Map<Long, Status> repliedStatusById = repliedStatusesFor(messages);

        List<MessageResponse> responses = new ArrayList<>();
        for (Message message : messages) {
            boolean hiddenForMe = hiddenMessageIds.contains(message.getId());
            if (hiddenForMe) {
                continue;
            }

            boolean authorBlocked = blockedAuthorIds.contains(message.getSender().getId());
            if (authorBlocked) {
                continue;
            }

            MessageStatusUpdate status = statusByMessageId.get(message.getId());
            List<ReactionEntry> reactions = reactionsByMessageId.getOrDefault(message.getId(), List.of());

            responses.add(buildMessageResponse(message, status, reactions, repliedStatusById));
        }
        return responses;
    }

    private MessageResponse buildMessageResponse(Message message,
                                                 MessageStatusUpdate status,
                                                 List<ReactionEntry> reactions,
                                                 Map<Long, Status> repliedStatusById) {
        ReplySummary reply = ReplySummary.from(message.getReplyTo());
        StatusPreviewDto statusPreview = buildStatusPreview(message, repliedStatusById);

        MessageStatus aggregatedStatus = MessageStatus.SENT;
        int deliveredCount = 0;
        int readCount = 0;
        int totalRecipients = 0;
        if (status != null) {
            aggregatedStatus = status.getStatus();
            deliveredCount = status.getDeliveredCount();
            readCount = status.getReadCount();
            totalRecipients = status.getTotalRecipients();
        }

        return MessageResponse.builder()
                .id(message.getId())
                .senderId(message.getSender().getId())
                .content(message.getContent())
                .createdAt(message.getCreatedAt())
                .status(aggregatedStatus)
                .deliveredCount(deliveredCount)
                .readCount(readCount)
                .totalRecipients(totalRecipients)
                .type(message.getType().name())
                .mediaUrl(storageService.presignedUrl(message.getMediaUrl()))
                .replyToId(reply.getReplyToId())
                .replyToSenderId(reply.getReplyToSenderId())
                .replyToSenderName(reply.getReplyToSenderName())
                .replyToContent(reply.getReplyToContent())
                .replyToType(reply.getReplyToType())
                .replyToDeleted(reply.isReplyToDeleted())
                .reactions(reactions)
                .statusPreview(statusPreview)
                .edited(message.isEdited())
                .deleted(message.isDeleted())
                .build();
    }

    private StatusPreviewDto buildStatusPreview(Message message, Map<Long, Status> repliedStatusById) {
        Long statusId = message.getReplyToStatusId();
        if (statusId == null) {
            return null;
        }

        Status status = repliedStatusById.get(statusId);
        if (status == null) {
            return null;
        }

        String authorName = status.getAuthor().getName();
        String content = status.getContent();
        String mediaUrl = storageService.presignedUrl(status.getMediaUrl());
        return new StatusPreviewDto(authorName, content, mediaUrl);
    }

    private List<Long> collectIds(List<Message> messages) {
        List<Long> messageIds = new ArrayList<>();
        for (Message message : messages) {
            messageIds.add(message.getId());
        }
        return messageIds;
    }

    private Set<Long> hiddenMessageIdsFor(Long currentUserId, List<Long> messageIds) {
        List<DeletedMessage> deletedMessages =
                deletedMessageRepository.findByUser_IdAndMessage_IdIn(currentUserId, messageIds);

        Set<Long> hiddenMessageIds = new HashSet<>();
        for (DeletedMessage deletedMessage : deletedMessages) {
            hiddenMessageIds.add(deletedMessage.getMessage().getId());
        }
        return hiddenMessageIds;
    }

    private Map<Long, Status> repliedStatusesFor(List<Message> messages) {
        Set<Long> statusIds = new HashSet<>();
        for (Message message : messages) {
            Long statusId = message.getReplyToStatusId();
            if (statusId != null) {
                statusIds.add(statusId);
            }
        }

        Map<Long, Status> statusById = new HashMap<>();
        for (Status status : statusRepository.findAllById(statusIds)) {
            statusById.put(status.getId(), status);
        }
        return statusById;
    }
}