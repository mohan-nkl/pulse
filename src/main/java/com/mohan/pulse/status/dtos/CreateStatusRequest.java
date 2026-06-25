package com.mohan.pulse.status.dtos;

import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CreateStatusRequest {

    @Size(min = 1, max = 700, message = "Status text must be between 1 and 700 characters")
    private String content;

    private String mediaUrl;
}
