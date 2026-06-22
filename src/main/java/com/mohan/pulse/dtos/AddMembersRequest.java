package com.mohan.pulse.dtos;

import jakarta.validation.constraints.NotEmpty;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
public class AddMembersRequest {

    @NotEmpty(message = "At least one member id is required")
    private List<Long> memberIds;
}