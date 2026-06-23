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

    // Non-null only when this message is a status reply.
    // Null means it's a regular message — frontend renders it normally.
    private StatusPreviewDto statusPreview;

    public ChatMessageResponse(Long id, String conversationId, Long id1, String content, Instant createdAt) {
    }
}