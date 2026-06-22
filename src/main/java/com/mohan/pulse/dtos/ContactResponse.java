package com.mohan.pulse.dtos;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class ContactResponse {

    private Long userId;
    private String name;
    private String avatarUrl;
}