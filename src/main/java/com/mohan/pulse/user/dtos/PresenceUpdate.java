package com.mohan.pulse.user.dtos;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.Instant;

@Getter
@AllArgsConstructor
public class PresenceUpdate {

    private Long userId;
    private boolean online;
    private Instant lastSeen;
}
