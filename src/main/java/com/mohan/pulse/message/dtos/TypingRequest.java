package com.mohan.pulse.message.dtos;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class TypingRequest {
    private String conversationId;
    private boolean typing;
}
