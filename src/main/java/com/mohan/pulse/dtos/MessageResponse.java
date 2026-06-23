package com.mohan.pulse.dtos;

import com.mohan.pulse.models.MessageStatus;
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
    private MessageStatus status;
    private int deliveredCount;
    private int readCount;
    private int totalRecipients;

    // Non-null only when this message is a status reply.
    private StatusPreviewDto statusPreview;
}