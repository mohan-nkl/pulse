package com.mohan.pulse.dtos;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class MessageDeletedEvent {

    private Long messageId;
    private String conversationId;
}