package com.mohan.pulse.message;

import com.mohan.pulse.message.dtos.TypingEvent;
import com.mohan.pulse.group.GroupMember;
import com.mohan.pulse.group.GroupMemberRepository;
import com.mohan.pulse.common.ConversationUtil;
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
    private final com.mohan.pulse.block.BlockService blockService;

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
        long[] participants = ConversationUtil.dmParticipants(conversationId);  // [smaller, larger]
        long a = participants[0];
        long b = participants[1];

        if (senderId != a && senderId != b) {
            return;
        }

        long recipientId = (senderId == a) ? b : a;

        // No typing indicator across a block (either direction).
        if (blockService.isBlockedBetween(senderId, recipientId)) {
            return;
        }

        send(recipientId, new TypingEvent(conversationId, senderId, typing));
    }


    private void relayGroup(Long senderId, String conversationId, boolean typing) {
        Long groupId = ConversationUtil.groupIdFrom(conversationId);

        if (!groupMemberRepository.existsByGroupIdAndUserId(groupId, senderId)) {
            return;
        }

        List<GroupMember> members = groupMemberRepository.findByGroupId(groupId);

        TypingEvent event = new TypingEvent(conversationId, senderId, typing);
        for (GroupMember member : members) {
            Long memberId = member.getUser().getId();
            if (!memberId.equals(senderId)
                    && !blockService.isBlockedBetween(senderId, memberId)) {
                send(memberId, event);
            }
        }
    }


    private void send(Long recipientId, TypingEvent event) {
        messagingTemplate.convertAndSendToUser(
                recipientId.toString(), USER_TYPING_QUEUE, event);
    }
}