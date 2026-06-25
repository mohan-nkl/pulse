package com.mohan.pulse.user;

import com.mohan.pulse.common.ApiResponse;
import com.mohan.pulse.common.SecurityUtil;
import com.mohan.pulse.user.dtos.PresenceUpdate;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/presence")
@RequiredArgsConstructor
public class PresenceController {

    private final PresenceService presenceService;

    @GetMapping("/{userId}")
    public ApiResponse<PresenceUpdate> getPresence(@PathVariable Long userId) {
        Long viewerId = SecurityUtil.currentUserId();
        return ApiResponse.ok(presenceService.getPresenceFor(viewerId, userId));
    }

    @PostMapping
    public ApiResponse<List<PresenceUpdate>> getPresenceFor(@RequestBody List<Long> userIds) {
        Long viewerId = SecurityUtil.currentUserId();
        return ApiResponse.ok(presenceService.getPresenceForViewer(viewerId, userIds));
    }
}
