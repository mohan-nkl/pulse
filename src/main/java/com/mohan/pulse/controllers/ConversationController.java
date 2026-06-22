package com.mohan.pulse.controllers;

import com.mohan.pulse.dtos.ApiResponse;
import com.mohan.pulse.dtos.MessageResponse;
import com.mohan.pulse.security.SecurityUtil;
import com.mohan.pulse.services.ConversationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/conversations")
@RequiredArgsConstructor
public class ConversationController {

    private final ConversationService conversationService;

    @GetMapping("/{otherUserId}")
    public ApiResponse<List<MessageResponse>> getConversation(@PathVariable Long otherUserId) {
        Long currentUserId = SecurityUtil.currentUserId();
        List<MessageResponse> history =
                conversationService.getDirectConversation(currentUserId, otherUserId);
        return ApiResponse.ok(history);
    }
}