package com.mohan.pulse.dtos;

import jakarta.validation.constraints.NotEmpty;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
public class SyncRequest {

    @NotEmpty(message = "Phone list must not be empty.")
    private List<String> phones;
}