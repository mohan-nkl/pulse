package com.mohan.pulse.status.dtos;

import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CreateStatusRequest {

    // Optional when mediaUrl is provided. Required for text-only statuses.
    @Size(min = 1, max = 700, message = "Status text must be between 1 and 700 characters")
    private String content;

    // Optional — filled in after a separate image upload call.
    // Null for text-only statuses.
    private String mediaUrl;
}