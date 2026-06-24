package com.mohan.pulse.status.dtos;

import lombok.Builder;
import lombok.Getter;

import java.time.Instant;

@Getter
@Builder
public class StatusResponse {

    private Long id;

    // Author info — denormalised here so the frontend doesn't need
    // a second API call just to show the name and avatar.
    private Long authorId;
    private String authorName;
    private String authorAvatarUrl;

    // Content — either of these can be null but never both.
    private String content;   // text caption (null for image-only)
    private String mediaUrl;  // image URL (null for text-only)

    private Instant createdAt;
    private Instant expiresAt;

    // Only populated when the current user IS the author.
    // Null for everyone else (no need to query it for the feed).
    private Long viewCount;

    // True if the currently authenticated user has already opened this status.
    // Drives the green "unread" ring on the frontend.
    private boolean viewedByMe;
}