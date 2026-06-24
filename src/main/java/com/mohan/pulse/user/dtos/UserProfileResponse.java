package com.mohan.pulse.user.dtos;

import lombok.Builder;
import lombok.Getter;

import java.time.Instant;

@Getter
@Builder
public class UserProfileResponse {
    private Long id;
    private String name;
    private String about;
    private String avatarUrl;
    private Instant lastSeen;
    private Instant createdAt;
}