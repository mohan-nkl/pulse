package com.mohan.pulse.dtos;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class AddContactRequest {

    @NotBlank(message = "Phone number is required.")
    private String phone;

    private String alias;
}
