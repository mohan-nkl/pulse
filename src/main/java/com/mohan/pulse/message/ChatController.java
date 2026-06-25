package com.mohan.pulse.message;

import com.mohan.pulse.message.dtos.ConversationAckRequest;
import com.mohan.pulse.message.dtos.SendGroupMessageRequest;
import com.mohan.pulse.notification.NotificationService;
import com.mohan.pulse.message.dtos.SendMessageRequest;
import com.mohan.pulse.message.dtos.TypingRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.stereotype.Controller;

import java.security.Principal;

@Controller
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;
    private final MessageStatusService messageStatusService;
    private final TypingService typingService;
    private final NotificationService notificationService;

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
        notificationService.clearUnread(recipientId, request.getConversationId());
    }

    @MessageMapping("/chat.typing")
    public void typing(TypingRequest request, Principal principal) {
        Long senderId = Long.valueOf(principal.getName());
        typingService.handleTyping(senderId, request.getConversationId(), request.isTyping());
    }
}
