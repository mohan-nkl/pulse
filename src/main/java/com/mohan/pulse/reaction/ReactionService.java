package com.mohan.pulse.reaction;

import com.mohan.pulse.common.ApiException;
import com.mohan.pulse.common.ConversationUtil;
import com.mohan.pulse.group.GroupMember;
import com.mohan.pulse.group.GroupMemberRepository;
import com.mohan.pulse.message.Message;
import com.mohan.pulse.message.MessageRepository;
import com.mohan.pulse.notification.NotificationService;
import com.mohan.pulse.reaction.dtos.ReactionEntry;
import com.mohan.pulse.reaction.dtos.ReactionUpdate;
import com.mohan.pulse.user.User;
import com.mohan.pulse.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ReactionService {

    private static final String USER_REACTIONS_QUEUE = "/queue/reactions";

    private final ReactionRepository reactionRepository;
    private final MessageRepository messageRepository;
    private final UserRepository userRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final NotificationService notificationService;

    @Transactional
    public void react(Long userId, Long messageId, String emoji) {
        boolean emojiMissing = (emoji == null || emoji.isBlank());
        if (emojiMissing) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Emoji is required.");
        }

        Message message = findMessageOrThrow(messageId);
        ensureMember(userId, message.getConversationId());

        Reaction reaction = findOrCreateReaction(message, userId);
        reaction.setEmoji(emoji);
        reactionRepository.save(reaction);

        broadcast(message);
        notifyAuthorIfNeeded(message, userId, emoji);
    }

    @Transactional
    public void unreact(Long userId, Long messageId) {
        Message message = findMessageOrThrow(messageId);
        ensureMember(userId, message.getConversationId());

        Optional<Reaction> existingReaction =
                reactionRepository.findByMessage_IdAndUser_Id(messageId, userId);
        if (existingReaction.isPresent()) {
            reactionRepository.delete(existingReaction.get());
        }

        broadcast(message);
    }

    @Transactional(readOnly = true)
    public Map<Long, List<ReactionEntry>> reactionsForMessages(List<Long> messageIds) {
        if (messageIds.isEmpty()) {
            return Map.of();
        }

        List<Reaction> reactions = reactionRepository.findByMessage_IdIn(messageIds);

        Map<Long, List<ReactionEntry>> entriesByMessageId = new HashMap<>();
        for (Reaction reaction : reactions) {
            Long messageId = reaction.getMessage().getId();
            ReactionEntry entry = toEntry(reaction);

            List<ReactionEntry> entriesForMessage = entriesByMessageId.get(messageId);
            if (entriesForMessage == null) {
                entriesForMessage = new ArrayList<>();
                entriesByMessageId.put(messageId, entriesForMessage);
            }
            entriesForMessage.add(entry);
        }
        return entriesByMessageId;
    }

    private Reaction findOrCreateReaction(Message message, Long userId) {
        Optional<Reaction> existingReaction =
                reactionRepository.findByMessage_IdAndUser_Id(message.getId(), userId);
        if (existingReaction.isPresent()) {
            return existingReaction.get();
        }

        Reaction reaction = new Reaction();
        reaction.setMessage(message);
        reaction.setUser(userRepository.getReferenceById(userId));
        return reaction;
    }

    private void notifyAuthorIfNeeded(Message message, Long reactorId, String emoji) {
        Long authorId = message.getSender().getId();

        boolean reactingToOwnMessage = authorId.equals(reactorId);
        if (reactingToOwnMessage) {
            return;
        }

        String reactorName = reactorNameOf(reactorId);
        notificationService.sendReactionNotification(
                authorId, message.getConversationId(), reactorName, emoji);
    }

    private String reactorNameOf(Long reactorId) {
        Optional<User> maybeReactor = userRepository.findById(reactorId);
        if (maybeReactor.isEmpty()) {
            return "Someone";
        }
        return maybeReactor.get().getName();
    }

    private List<ReactionEntry> currentReactions(Long messageId) {
        List<Reaction> reactions = reactionRepository.findByMessage_Id(messageId);

        List<ReactionEntry> entries = new ArrayList<>();
        for (Reaction reaction : reactions) {
            entries.add(toEntry(reaction));
        }
        return entries;
    }

    private ReactionEntry toEntry(Reaction reaction) {
        User user = reaction.getUser();
        return new ReactionEntry(user.getId(), user.getName(), reaction.getEmoji());
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
            long[] participants = ConversationUtil.dmParticipants(conversationId);
            boolean isParticipant = (userId == participants[0] || userId == participants[1]);
            if (!isParticipant) {
                throw new ApiException(HttpStatus.FORBIDDEN,
                        "You are not part of this conversation.");
            }
        } else if (ConversationUtil.isGroup(conversationId)) {
            Long groupId = ConversationUtil.groupIdFrom(conversationId);
            boolean isMember = groupMemberRepository.existsByGroupIdAndUserId(groupId, userId);
            if (!isMember) {
                throw new ApiException(HttpStatus.FORBIDDEN,
                        "You are not a member of this group.");
            }
        }
    }

    private Message findMessageOrThrow(Long messageId) {
        Optional<Message> maybeMessage = messageRepository.findById(messageId);
        if (maybeMessage.isEmpty()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Message not found.");
        }
        return maybeMessage.get();
    }
}