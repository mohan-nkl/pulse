package com.mohan.pulse.notification;

import com.mohan.pulse.common.ApiResponse;
import com.mohan.pulse.common.SecurityUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/*
 * NotificationController gives the frontend a REST endpoint to fetch
 * the current unread count when the page first loads
 * (before the WebSocket has connected).
 *
 * Example:
 *   GET /api/notifications/unread-count
 *   Response: { "status": "success", "data": 5 }
 */
@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    @GetMapping("/unread-count")
    public ApiResponse<Integer> getUnreadCount() {
        // SecurityUtil reads the userId from the JWT token automatically
        Long currentUserId = SecurityUtil.currentUserId();
        int count = notificationService.getTotalUnread(currentUserId);
        return ApiResponse.ok(count);
    }
}