package com.mohan.pulse.message;

import com.mohan.pulse.common.ApiResponse;
import com.mohan.pulse.message.dtos.ConversationPartner;
import com.mohan.pulse.message.dtos.PagedMessages;
import com.mohan.pulse.common.SecurityUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/conversations")
@RequiredArgsConstructor
public class ConversationController {

    private final ConversationService conversationService;

    @GetMapping("/{otherUserId}")
    public ApiResponse<PagedMessages> getConversation(
            @PathVariable Long otherUserId,
            @RequestParam(required = false) Long before,
            @RequestParam(defaultValue = "30") int limit) {
        Long currentUserId = SecurityUtil.currentUserId();
        return ApiResponse.ok(conversationService.getDirectConversation(
                currentUserId, otherUserId, before, limit));
    }

    @GetMapping("/group/{groupId}")
    public ApiResponse<PagedMessages> getGroupConversation(
            @PathVariable Long groupId,
            @RequestParam(required = false) Long before,
            @RequestParam(defaultValue = "30") int limit) {
        Long currentUserId = SecurityUtil.currentUserId();
        return ApiResponse.ok(conversationService.getGroupConversation(
                currentUserId, groupId, before, limit));
    }

    @GetMapping("/unread-counts")
    public ApiResponse<Map<String, Integer>> getUnreadCounts() {
        Long currentUserId = SecurityUtil.currentUserId();
        return ApiResponse.ok(conversationService.getUnreadCounts(currentUserId));
    }

    @GetMapping("/partners")
    public ApiResponse<List<ConversationPartner>> getPartners() {
        Long currentUserId = SecurityUtil.currentUserId();
        return ApiResponse.ok(conversationService.getPartners(currentUserId));
    }

    @GetMapping("/summaries")
    public ApiResponse<Map<String, Instant>> getConversationSummaries() {
        Long currentUserId = SecurityUtil.currentUserId();
        return ApiResponse.ok(conversationService.getConversationSummaries(currentUserId));
    }

    @GetMapping("/hidden")
    public ApiResponse<List<String>> getHiddenConversations() {
        Long currentUserId = SecurityUtil.currentUserId();
        return ApiResponse.ok(conversationService.getHiddenConversations(currentUserId));
    }

    @DeleteMapping("/{otherUserId}")
    public ApiResponse<Void> clearDirectConversation(@PathVariable Long otherUserId) {
        Long currentUserId = SecurityUtil.currentUserId();
        conversationService.clearDirectConversation(currentUserId, otherUserId);
        return ApiResponse.ok("Conversation deleted.", null);
    }

    @DeleteMapping("/group/{groupId}")
    public ApiResponse<Void> clearGroupConversation(@PathVariable Long groupId) {
        Long currentUserId = SecurityUtil.currentUserId();
        conversationService.clearGroupConversation(currentUserId, groupId);
        return ApiResponse.ok("Conversation deleted.", null);
    }
}
