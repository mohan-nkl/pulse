package com.mohan.pulse.dtos;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.List;


@Getter
@AllArgsConstructor
public class ReactionUpdate {

    private Long messageId;
    private String conversationId;
    private List<ReactionEntry> reactions;
}