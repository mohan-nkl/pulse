package com.mohan.pulse.user;

import com.mohan.pulse.dtos.ApiResponse;
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
        return ApiResponse.ok(presenceService.getPresence(userId));
    }

    @PostMapping
    public ApiResponse<List<PresenceUpdate>> getPresenceFor(@RequestBody List<Long> userIds) {
        return ApiResponse.ok(presenceService.getPresenceFor(userIds));
    }
}