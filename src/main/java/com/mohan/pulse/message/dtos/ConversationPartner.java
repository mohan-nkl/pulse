package com.mohan.pulse.message.dtos;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.Instant;

@Getter
@AllArgsConstructor
public class ConversationPartner {
    private Long userId;
    private String name;
    private String phone;
    private String avatarUrl;
    private Instant lastSeen;
}