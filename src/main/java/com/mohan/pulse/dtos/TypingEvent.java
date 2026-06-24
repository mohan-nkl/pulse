package com.mohan.pulse.dtos;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class TypingEvent {
    private String conversationId;
    private Long userId;
    private boolean typing;
}