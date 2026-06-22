package com.mohan.pulse.dtos;

import com.mohan.pulse.models.GroupRole;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class GroupMemberResponse {

    private Long userId;
    private String name;
    private String avatarUrl;
    private GroupRole role;
}