package com.mohan.pulse.dtos;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * What a client sends over WebSocket to deliver a group message.
 */
@Getter
@Setter
@NoArgsConstructor
public class SendGroupMessageRequest {

    private Long groupId;

    // For TEXT: the message text.
    // For media: optional caption (can be empty).
    private String content;

    // Defaults to TEXT if the frontend doesn't send this field.
    private String messageType = "TEXT";

    // Null for text messages. Has the file URL for media messages.
    private String mediaUrl;
}