package com.mohan.pulse.group.dtos;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class UpdateGroupRequest {

    @NotBlank(message = "Group name is required")
    private String name;
}