package com.mohan.pulse.dtos;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.Instant;

@Getter
@AllArgsConstructor
public class ChatMessageResponse {

    private Long id;
    private String conversationId;
    private Long senderId;
    private String content;
    private Instant createdAt;
}