package com.mohan.pulse.dtos;

import lombok.AllArgsConstructor;
import lombok.Getter;


@Getter
@AllArgsConstructor
public class ReactionEntry {

    private Long userId;
    private String userName;
    private String emoji;
}