package com.mohan.pulse.status.dtos;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.Instant;

@Getter
@AllArgsConstructor
public class StatusViewerResponse {
    private Long viewerId;
    private String viewerName;
    private String viewerAvatarUrl;
    private Instant viewedAt;
}