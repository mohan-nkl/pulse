package com.mohan.pulse.services;

import com.mohan.pulse.dtos.ChatMessageResponse;
import com.mohan.pulse.dtos.SendMessageRequest;
import com.mohan.pulse.exceptions.ApiException;
import com.mohan.pulse.models.ConversationType;
import com.mohan.pulse.models.Message;
import com.mohan.pulse.models.MessageType;
import com.mohan.pulse.models.User;
import com.mohan.pulse.repositories.MessageRepository;
import com.mohan.pulse.repositories.UserRepository;
import com.mohan.pulse.utils.ConversationUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;


@Service
@RequiredArgsConstructor
public class ChatService {

    private static final String USER_QUEUE = "/queue/messages";

    private final UserRepository userRepository;
    private final MessageRepository messageRepository;
    private final SimpMessagingTemplate messagingTemplate;

    public ChatMessageResponse sendDirectMessage(Long senderId, SendMessageRequest request) {

        validate(request);

        User sender = findUser(senderId, "Sender not found");
        User receiver = findUser(request.getReceiverId(), "Receiver not found");

        if (sender.getId().equals(receiver.getId())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "You cannot message yourself");
        }

        String conversationId =
                ConversationUtil.dmConversationId(sender.getId(), receiver.getId());

        Message message = new Message();
        message.setConversationId(conversationId);
        message.setConversationType(ConversationType.DIRECT);
        message.setSender(sender);
        message.setType(MessageType.TEXT);
        message.setContent(request.getContent());

        Message saved = messageRepository.save(message);

        ChatMessageResponse response = new ChatMessageResponse(
                saved.getId(),
                saved.getConversationId(),
                sender.getId(),
                saved.getContent(),
                saved.getCreatedAt());

        messagingTemplate.convertAndSendToUser(receiver.getId().toString(), USER_QUEUE, response);
        messagingTemplate.convertAndSendToUser(sender.getId().toString(), USER_QUEUE, response);

        return response;
    }

    private void validate(SendMessageRequest request) {
        if (request.getReceiverId() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Receiver id is required");
        }
        if (request.getContent() == null || request.getContent().isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Message content must not be empty");
        }
    }

    private User findUser(Long id, String notFoundMessage) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, notFoundMessage));
    }
}