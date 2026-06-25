package com.mohan.pulse.message;

import com.mohan.pulse.common.ApiResponse;
import com.mohan.pulse.message.dtos.EditMessageRequest;
import com.mohan.pulse.common.SecurityUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/messages")
@RequiredArgsConstructor
public class MessageActionController {

    private final MessageActionService messageActionService;

    @DeleteMapping("/{messageId}/for-me")
    public ApiResponse<Void> deleteForMe(@PathVariable Long messageId) {
        Long currentUserId = SecurityUtil.currentUserId();
        messageActionService.deleteForMe(currentUserId, messageId);
        return ApiResponse.ok(null);
    }

    @DeleteMapping("/{messageId}/for-everyone")
    public ApiResponse<Void> deleteForEveryone(@PathVariable Long messageId) {
        Long currentUserId = SecurityUtil.currentUserId();
        messageActionService.deleteForEveryone(currentUserId, messageId);
        return ApiResponse.ok(null);
    }

    @PutMapping("/{messageId}")
    public ApiResponse<Void> editMessage(@PathVariable Long messageId,
                                         @RequestBody EditMessageRequest request) {
        Long currentUserId = SecurityUtil.currentUserId();
        messageActionService.editMessage(currentUserId, messageId, request.getContent());
        return ApiResponse.ok(null);
    }
}
