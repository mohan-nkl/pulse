package com.mohan.pulse.dtos;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class SendMessageRequest {

    private Long receiverId;

    private String content;

    private String messageType = "TEXT";

    private String mediaUrl;

    private Long replyToId;

    // Optional — set only when this message is a status reply.
    private Long replyToStatusId;
}