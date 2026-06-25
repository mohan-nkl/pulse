package com.mohan.pulse.message.dtos;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.List;

@Getter
@AllArgsConstructor
public class PagedMessages {
    private List<MessageResponse> messages;
    private boolean hasMore;
}
