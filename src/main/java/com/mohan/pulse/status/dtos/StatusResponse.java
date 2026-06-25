package com.mohan.pulse.status.dtos;

import lombok.Builder;
import lombok.Getter;

import java.time.Instant;

@Getter
@Builder
public class StatusResponse {

    private Long id;

    private Long authorId;
    private String authorName;
    private String authorAvatarUrl;

    private String content;
    private String mediaUrl;

    private Instant createdAt;
    private Instant expiresAt;

    private Long viewCount;

    private boolean viewedByMe;
}
