package com.mohan.pulse.dtos;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
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

    @NotNull(message = "Receiver id is required")
    private Long receiverId;

    @NotBlank(message = "Message content must not be empty")
    private String content;
}