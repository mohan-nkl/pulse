package com.mohan.pulse.message.dtos;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class SendGroupMessageRequest {

    private Long groupId;

    private String content;

    private String messageType = "TEXT";

    private String mediaUrl;

    private Long replyToId;
}