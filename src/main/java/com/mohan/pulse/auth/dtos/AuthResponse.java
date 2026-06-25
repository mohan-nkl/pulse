package com.mohan.pulse.auth.dtos;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class AuthResponse {

    private final String token;

    private final Long userId;

    private final String phone;

    private final String name;

    private final String avatarUrl;
}
