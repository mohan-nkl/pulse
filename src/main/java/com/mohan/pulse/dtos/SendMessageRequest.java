package com.mohan.pulse.dtos;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * What a client sends (over WebSocket) to deliver a one-to-one message.
 * The service validates these fields before saving.
 */
@Getter
@Setter
@NoArgsConstructor
public class SendMessageRequest {

    private Long receiverId;

    // For TEXT: the message text.
    // For media: optional caption (can be empty).
    private String content;

    // Defaults to TEXT if the frontend doesn't send this field.
    private String messageType = "TEXT";

    // Null for text messages. Has the file URL for media messages.
    private String mediaUrl;
}