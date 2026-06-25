package com.mohan.pulse.user.dtos;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.Instant;

@Getter
@AllArgsConstructor
public class UserProfileResponse {

    private Long id;
    private String name;
    private String about;
    private String avatarUrl;
    private Instant lastSeen;
    private Instant createdAt;
}
