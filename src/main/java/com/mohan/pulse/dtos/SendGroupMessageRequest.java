package com.mohan.pulse.dtos;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class SendGroupMessageRequest {

    @NotNull(message = "Group id is required")
    private Long groupId;

    @NotBlank(message = "Message content must not be empty")
    private String content;
}