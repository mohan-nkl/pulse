package com.mohan.pulse.block;

import com.mohan.pulse.block.dtos.BlockedUserResponse;
import com.mohan.pulse.common.ApiResponse;
import com.mohan.pulse.common.SecurityUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/blocks")
@RequiredArgsConstructor
public class BlockController {

    private final BlockService blockService;

    // Block a user.
    @PostMapping("/{userId}")
    public ApiResponse<Void> block(@PathVariable Long userId) {
        blockService.block(SecurityUtil.currentUserId(), userId);
        return ApiResponse.ok(null);
    }

    // Unblock a user.
    @DeleteMapping("/{userId}")
    public ApiResponse<Void> unblock(@PathVariable Long userId) {
        blockService.unblock(SecurityUtil.currentUserId(), userId);
        return ApiResponse.ok(null);
    }

    // List everyone I've blocked.
    @GetMapping
    public ApiResponse<List<BlockedUserResponse>> listBlocked() {
        return ApiResponse.ok(blockService.listBlocked(SecurityUtil.currentUserId()));
    }

    // Quick check: have I blocked this user? (for the chat header / profile button state)
    @GetMapping("/{userId}/status")
    public ApiResponse<Map<String, Boolean>> status(@PathVariable Long userId) {
        boolean blocked = blockService.hasBlocked(SecurityUtil.currentUserId(), userId);
        return ApiResponse.ok(Map.of("blocked", blocked));
    }
}