package com.mohan.pulse.services;

import com.mohan.pulse.dtos.MessageResponse;
import com.mohan.pulse.models.Message;
import com.mohan.pulse.repositories.MessageRepository;
import com.mohan.pulse.utils.ConversationUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;


@Service
@RequiredArgsConstructor
public class ConversationService {

    private final MessageRepository messageRepository;

    public List<MessageResponse> getDirectConversation(Long currentUserId, Long otherUserId) {

        String conversationId =
                ConversationUtil.dmConversationId(currentUserId, otherUserId);

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