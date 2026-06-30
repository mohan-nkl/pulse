package com.mohan.pulse.call;

import com.mohan.pulse.call.dtos.CallLogDto;
import com.mohan.pulse.call.dtos.RecordCallRequest;
import com.mohan.pulse.common.ApiResponse;
import com.mohan.pulse.common.SecurityUtil;
import com.mohan.pulse.message.dtos.ChatMessageResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/calls")
@RequiredArgsConstructor
public class CallLogController {

    private final CallLogService callLogService;

    @PostMapping("/log")
    public ApiResponse<ChatMessageResponse> log(@RequestBody RecordCallRequest request) {
        Long callerId = SecurityUtil.currentUserId();
        return ApiResponse.ok("Call logged.", callLogService.recordCall(callerId, request));
    }

    @GetMapping
    public ApiResponse<List<CallLogDto>> myLogs() {
        Long userId = SecurityUtil.currentUserId();
        return ApiResponse.ok(callLogService.myCallLogs(userId));
    }
}