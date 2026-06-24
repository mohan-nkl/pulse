package com.mohan.pulse.reaction;

import com.mohan.pulse.dtos.ApiResponse;
import com.mohan.pulse.reaction.dtos.ReactionRequest;
import com.mohan.pulse.security.SecurityUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/messages")
@RequiredArgsConstructor
public class ReactionController {

    private final ReactionService reactionService;

    @PostMapping("/{messageId}/reactions")
    public ApiResponse<Void> react(@PathVariable Long messageId,
                                   @RequestBody ReactionRequest request) {
        Long currentUserId = SecurityUtil.currentUserId();
        reactionService.react(currentUserId, messageId, request.getEmoji());
        return ApiResponse.ok(null);
    }

    @DeleteMapping("/{messageId}/reactions")
    public ApiResponse<Void> unreact(@PathVariable Long messageId) {
        Long currentUserId = SecurityUtil.currentUserId();
        reactionService.unreact(currentUserId, messageId);
        return ApiResponse.ok(null);
    }
}