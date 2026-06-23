package com.mohan.pulse.dtos;

import com.mohan.pulse.models.MessageStatus;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.Instant;

@Getter
@AllArgsConstructor
public class RecipientStatusEntry {

    private Long userId;
    private String name;
    private String avatarUrl;
    private MessageStatus status;
    private Instant deliveredAt;
    private Instant readAt;
}