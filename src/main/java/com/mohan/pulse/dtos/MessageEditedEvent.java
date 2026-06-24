package com.mohan.pulse.dtos;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class MessageEditedEvent {
    private Long messageId;
    private String conversationId;
    private String content;
}