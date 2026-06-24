package com.mohan.pulse.status.dtos;

import lombok.Builder;
import lombok.Getter;

import java.time.Instant;

@Getter
@Builder
public class StatusViewerResponse {
    private Long   viewerId;
    private String viewerName;
    private String viewerAvatarUrl;
    private Instant viewedAt;
}