package com.mohan.pulse.contact.dtos;

import lombok.Builder;
import lombok.Getter;

import java.time.Instant;

@Getter
@Builder
public class ContactResponse {
    private Long id;
    private Long contactId;
    private String name;
    private String alias;
    private String avatarUrl;
    private Instant lastSeen;
    private Instant addedAt;
}
