package com.mohan.pulse.reaction;

import com.mohan.pulse.common.ApiException;
import com.mohan.pulse.group.GroupMember;
import com.mohan.pulse.message.Message;
import com.mohan.pulse.user.User;
import com.mohan.pulse.group.GroupMemberRepository;
import com.mohan.pulse.reaction.dtos.ReactionEntry;
import com.mohan.pulse.reaction.dtos.ReactionUpdate;
import com.mohan.pulse.message.MessageRepository;
import com.mohan.pulse.user.UserRepository;
import com.mohan.pulse.common.ConversationUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ReactionService {

    private static final String USER_REACTIONS_QUEUE = "/queue/reactions";

    private final ReactionRepository reactionRepository;
    private final MessageRepository messageRepository;
    private final UserRepository userRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final com.mohan.pulse.notification.NotificationService notificationService;

    @Transactional
    public void react(Long userId, Long messageId, String emoji) {
        if (emoji == null || emoji.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Emoji is required.");
        }

        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Message not found."));

        ensureMember(userId, message.getConversationId());

        Reaction reaction = reactionRepository
                .findByMessage_IdAndUser_Id(messageId, userId)
                .orElseGet(() -> {
                    Reaction r = new Reaction();
                    r.setMessage(message);
                    r.setUser(userRepository.getReferenceById(userId));
                    return r;
                });
        reaction.setEmoji(emoji);
        reactionRepository.save(reaction);

        broadcast(message);

        // Notify the message's sender that someone reacted (unless they reacted
        // to their own message). Toast only — does not affect unread counts.
        Long authorId = message.getSender().getId();
        if (!authorId.equals(userId)) {
            User reactor = userRepository.findById(userId).orElse(null);
            String reactorName = reactor != null ? reactor.getName() : "Someone";
            notificationService.sendReactionNotification(
                    authorId, message.getConversationId(), reactorName, emoji);
        }
    }

    @Transactional
    public void unreact(Long userId, Long messageId) {
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Message not found."));

        ensureMember(userId, message.getConversationId());

        reactionRepository.findByMessage_IdAndUser_Id(messageId, userId)
                .ifPresent(reactionRepository::delete);

        broadcast(message);
    }

    @Transactional(readOnly = true)
    public Map<Long, List<ReactionEntry>> reactionsForMessages(List<Long> messageIds) {
        if (messageIds.isEmpty()) {
            return Map.of();
        }
        return reactionRepository.findByMessage_IdIn(messageIds).stream()
                .collect(Collectors.groupingBy(
                        r -> r.getMessage().getId(),
                        Collectors.mapping(this::toEntry, Collectors.toList())));
    }

    private List<ReactionEntry> currentReactions(Long messageId) {
        return reactionRepository.findByMessage_Id(messageId).stream()
                .map(this::toEntry)
                .toList();
    }

    private ReactionEntry toEntry(Reaction r) {
        User u = r.getUser();
        return new ReactionEntry(u.getId(), u.getName(), r.getEmoji());
    }

    private void broadcast(Message message) {
        String conversationId = message.getConversationId();
        ReactionUpdate update = new ReactionUpdate(
                message.getId(), conversationId, currentReactions(message.getId()));

        if (ConversationUtil.isDirect(conversationId)) {
            long[] participants = ConversationUtil.dmParticipants(conversationId);
            send(participants[0], update);
            send(participants[1], update);
        } else if (ConversationUtil.isGroup(conversationId)) {
            Long groupId = ConversationUtil.groupIdFrom(conversationId);
            for (GroupMember member : groupMemberRepository.findByGroupId(groupId)) {
                send(member.getUser().getId(), update);
            }
        }
    }

    private void send(Long recipientId, ReactionUpdate update) {
        messagingTemplate.convertAndSendToUser(
                recipientId.toString(), USER_REACTIONS_QUEUE, update);
    }

    private void ensureMember(Long userId, String conversationId) {
        if (ConversationUtil.isDirect(conversationId)) {
            long[] p = ConversationUtil.dmParticipants(conversationId);
            if (userId != p[0] && userId != p[1]) {
                throw new ApiException(HttpStatus.FORBIDDEN,
                        "You are not part of this conversation.");
            }
        } else if (ConversationUtil.isGroup(conversationId)) {
            Long groupId = ConversationUtil.groupIdFrom(conversationId);
            if (!groupMemberRepository.existsByGroupIdAndUserId(groupId, userId)) {
                throw new ApiException(HttpStatus.FORBIDDEN,
                        "You are not a member of this group.");
            }
        }
    }
}