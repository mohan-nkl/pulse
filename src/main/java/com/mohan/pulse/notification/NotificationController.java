package com.mohan.pulse.notification;

import com.mohan.pulse.common.ApiResponse;
import com.mohan.pulse.common.SecurityUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    @GetMapping("/unread-count")
    public ApiResponse<Integer> getUnreadCount() {

        Long currentUserId = SecurityUtil.currentUserId();
        int count = notificationService.getTotalUnread(currentUserId);
        return ApiResponse.ok(count);
    }
}
