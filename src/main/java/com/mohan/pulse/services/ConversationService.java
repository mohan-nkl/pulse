package com.mohan.pulse.services;

import com.mohan.pulse.dtos.MessageResponse;
import com.mohan.pulse.exceptions.ApiException;
import com.mohan.pulse.models.Message;
import com.mohan.pulse.repositories.GroupMemberRepository;
import com.mohan.pulse.repositories.MessageRepository;
import com.mohan.pulse.utils.ConversationUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ConversationService {

    private final MessageRepository messageRepository;
    private final GroupMemberRepository groupMemberRepository;

    public List<MessageResponse> getDirectConversation(Long currentUserId, Long otherUserId) {

        String conversationId =
                ConversationUtil.dmConversationId(currentUserId, otherUserId);

        return messageRepository
                .findByConversationIdOrderByCreatedAtAsc(conversationId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public List<MessageResponse> getGroupConversation(Long currentUserId, Long groupId) {

        if (!groupMemberRepository.existsByGroupIdAndUserId(groupId, currentUserId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "You are not a member of this group.");
        }

        String conversationId = ConversationUtil.groupConversationId(groupId);

        return messageRepository
                .findByConversationIdOrderByCreatedAtAsc(conversationId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private MessageResponse toResponse(Message message) {
        return new MessageResponse(
                message.getId(),
                message.getSender().getId(),
                message.getContent(),
                message.getCreatedAt());
    }
}