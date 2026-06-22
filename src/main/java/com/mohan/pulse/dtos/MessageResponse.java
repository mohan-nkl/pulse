package com.mohan.pulse.dtos;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.Instant;

@Getter
@AllArgsConstructor
public class MessageResponse {

    private Long id;
    private Long senderId;
    private String content;
    private Instant createdAt;
}