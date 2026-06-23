package com.mohan.pulse.dtos;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.Instant;

/**
 * Sent to both the sender and recipient via WebSocket after a message is saved.
 * The frontend uses 'type' to decide how to render the bubble
 * (plain text, image, video, audio, or file download link).
 */
@Getter
@AllArgsConstructor
public class ChatMessageResponse {

    private Long id;
    private String conversationId;
    private Long senderId;
    private String content;
    private Instant createdAt;

    // "TEXT", "IMAGE", "AUDIO", "VIDEO", or "FILE"
    private String type;

    // null for text messages, has the file URL for media messages
    private String mediaUrl;
}