package com.mohan.pulse.message;

import com.mohan.pulse.block.BlockService;
import com.mohan.pulse.common.ConversationUtil;
import com.mohan.pulse.group.GroupMember;
import com.mohan.pulse.group.GroupMemberRepository;
import com.mohan.pulse.message.dtos.TypingEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class TypingService {

    private static final String USER_TYPING_QUEUE = "/queue/typing";

    private final GroupMemberRepository groupMemberRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final BlockService blockService;

    public void handleTyping(Long senderId, String conversationId, boolean typing) {
        if (conversationId == null) {
            return;
        }

        if (ConversationUtil.isDirect(conversationId)) {
            relayDirect(senderId, conversationId, typing);
        } else if (ConversationUtil.isGroup(conversationId)) {
            relayGroup(senderId, conversationId, typing);
        }
    }

    private void relayDirect(Long senderId, String conversationId, boolean typing) {
        long[] participants = ConversationUtil.dmParticipants(conversationId);
        long firstUserId = participants[0];
        long secondUserId = participants[1];

        boolean senderIsParticipant = (senderId == firstUserId || senderId == secondUserId);
        if (!senderIsParticipant) {
            return;
        }

        long recipientId;
        if (senderId == firstUserId) {
            recipientId = secondUserId;
        } else {
            recipientId = firstUserId;
        }

        boolean blocked = blockService.isBlockedBetween(senderId, recipientId);
        if (blocked) {
            return;
        }

        send(recipientId, new TypingEvent(conversationId, senderId, typing));
    }

    private void relayGroup(Long senderId, String conversationId, boolean typing) {
        Long groupId = ConversationUtil.groupIdFrom(conversationId);

        boolean senderIsMember = groupMemberRepository.existsByGroupIdAndUserId(groupId, senderId);
        if (!senderIsMember) {
            return;
        }

        List<GroupMember> members = groupMemberRepository.findByGroupId(groupId);
        TypingEvent event = new TypingEvent(conversationId, senderId, typing);

        for (GroupMember member : members) {
            Long memberId = member.getUser().getId();

            boolean isSender = memberId.equals(senderId);
            boolean blocked = blockService.isBlockedBetween(senderId, memberId);
            if (!isSender && !blocked) {
                send(memberId, event);
            }
        }
    }

    private void send(Long recipientId, TypingEvent event) {
        messagingTemplate.convertAndSendToUser(
                recipientId.toString(), USER_TYPING_QUEUE, event);
    }
}