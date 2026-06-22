package com.mohan.pulse.controllers;

import com.mohan.pulse.dtos.SendGroupMessageRequest;
import com.mohan.pulse.dtos.SendMessageRequest;
import com.mohan.pulse.services.ChatService;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.stereotype.Controller;

import java.security.Principal;

@Controller
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;

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
}