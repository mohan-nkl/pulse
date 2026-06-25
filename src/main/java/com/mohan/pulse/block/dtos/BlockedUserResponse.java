package com.mohan.pulse.block.dtos;

import java.time.Instant;

public record BlockedUserResponse(
        Long userId,
        String name,
        String avatarUrl,
        Instant blockedAt
) {}