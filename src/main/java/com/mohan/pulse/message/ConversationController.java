package com.mohan.pulse.message;

import com.mohan.pulse.common.ApiResponse;
import com.mohan.pulse.message.dtos.PagedMessages;
import com.mohan.pulse.common.SecurityUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/conversations")
@RequiredArgsConstructor
public class ConversationController {

    private final ConversationService conversationService;

    // GET /api/conversations/{otherUserId}
    // ?before=123  → messages with id < 123 (scroll-up load)
    // ?limit=30    → how many to return (default 30)
    // No ?before   → newest batch (first open)
    @GetMapping("/{otherUserId}")
    public ApiResponse<PagedMessages> getConversation(
            @PathVariable Long otherUserId,
            @RequestParam(required = false) Long before,
            @RequestParam(defaultValue = "30") int limit) {
        Long currentUserId = SecurityUtil.currentUserId();
        return ApiResponse.ok(conversationService.getDirectConversation(
                currentUserId, otherUserId, before, limit));
    }

    // GET /api/conversations/group/{groupId}
    @GetMapping("/group/{groupId}")
    public ApiResponse<PagedMessages> getGroupConversation(
            @PathVariable Long groupId,
            @RequestParam(required = false) Long before,
            @RequestParam(defaultValue = "30") int limit) {
        Long currentUserId = SecurityUtil.currentUserId();
        return ApiResponse.ok(conversationService.getGroupConversation(
                currentUserId, groupId, before, limit));
    }

    // GET /api/conversations/unread-counts
    // Returns { "dm:1:2": 3, "group:5": 1, ... }
    // Frontend shows these as badges on each chat list row.
    @GetMapping("/unread-counts")
    public ApiResponse<Map<String, Integer>> getUnreadCounts() {
        Long currentUserId = SecurityUtil.currentUserId();
        return ApiResponse.ok(conversationService.getUnreadCounts(currentUserId));
    }
}