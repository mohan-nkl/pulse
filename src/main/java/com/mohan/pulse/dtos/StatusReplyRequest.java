package com.mohan.pulse.dtos;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class StatusReplyRequest {

    @NotBlank(message = "Reply must not be blank")
    @Size(max = 1000, message = "Reply must not exceed 1000 characters")
    private String content;
}