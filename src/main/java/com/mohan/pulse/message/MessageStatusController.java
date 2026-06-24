package com.mohan.pulse.message;

import com.mohan.pulse.common.ApiResponse;
import com.mohan.pulse.message.dtos.MessageInfoResponse;
import com.mohan.pulse.common.SecurityUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/messages")
@RequiredArgsConstructor
public class MessageStatusController {

    private final MessageStatusService messageStatusService;


    @GetMapping("/{messageId}/status")
    public ApiResponse<MessageInfoResponse> getMessageInfo(@PathVariable Long messageId) {
        Long currentUserId = SecurityUtil.currentUserId();
        return ApiResponse.ok(messageStatusService.getMessageInfo(currentUserId, messageId));
    }
}