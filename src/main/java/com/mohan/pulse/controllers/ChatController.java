package com.mohan.pulse.controllers;

import com.mohan.pulse.dtos.ConversationAckRequest;
import com.mohan.pulse.dtos.SendGroupMessageRequest;
import com.mohan.pulse.dtos.SendMessageRequest;
import com.mohan.pulse.dtos.TypingRequest;
import com.mohan.pulse.services.ChatService;
import com.mohan.pulse.services.MessageStatusService;
import com.mohan.pulse.services.TypingService;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.stereotype.Controller;

import java.security.Principal;

@Controller
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;
    private final MessageStatusService messageStatusService;
    private final TypingService typingService;                 // NEW

    @MessageMapping("/chat.send")
    public void sendMessage(SendMessageRequest request, Principal principal) {
        Long senderId = Long.valueOf(principal.getName());
        chatService.sendDirectMessage(senderId, request);
    }

    @MessageMapping("/group.send")
    public void sendGroupMessage(SendGroupMessageRequest request, Principal principal) {
        Long senderId = Long.valueOf(principal.getName());
        chatService.sendGroupMessage(senderId, request);
    }

    @MessageMapping("/chat.delivered")
    public void markDelivered(ConversationAckRequest request, Principal principal) {
        Long recipientId = Long.valueOf(principal.getName());
        messageStatusService.markDelivered(recipientId, request.getConversationId());
    }

    @MessageMapping("/chat.read")
    public void markRead(ConversationAckRequest request, Principal principal) {
        Long recipientId = Long.valueOf(principal.getName());
        messageStatusService.markRead(recipientId, request.getConversationId());
    }

    @MessageMapping("/chat.typing")
    public void typing(TypingRequest request, Principal principal) {
        Long senderId = Long.valueOf(principal.getName());
        typingService.handleTyping(senderId, request.getConversationId(), request.isTyping());
    }
}