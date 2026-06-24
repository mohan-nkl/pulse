package com.mohan.pulse.group.dtos;

import com.mohan.pulse.group.GroupRole;
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