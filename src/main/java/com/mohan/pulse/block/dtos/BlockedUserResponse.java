package com.mohan.pulse.block.dtos;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.Instant;

@Getter
@AllArgsConstructor
public class BlockedUserResponse {

    private final Long userId;
    private final String name;
    private final String avatarUrl;
    private final Instant blockedAt;
}