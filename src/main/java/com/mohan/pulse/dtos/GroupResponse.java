package com.mohan.pulse.dtos;

import com.mohan.pulse.models.GroupRole;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.Instant;

@Getter
@AllArgsConstructor
public class GroupResponse {

    private Long id;
    private String name;
    private String avatarUrl;
    private GroupRole myRole;
    private int memberCount;
    private Instant createdAt;
}