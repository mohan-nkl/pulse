package com.mohan.pulse.call.dtos;

import lombok.Builder;
import lombok.Getter;

import java.time.Instant;

@Getter
@Builder
public class CallLogDto {

    private Long id;
    private Long peerUserId;
    private String peerName;
    private String peerAvatarUrl;
    private String direction;
    private String mediaType;
    private String status;        
    private Integer durationSec;
    private Instant createdAt;
}