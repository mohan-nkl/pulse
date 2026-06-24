package com.mohan.pulse.message.dtos;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.List;

// Wraps a page of messages with a flag telling the frontend
// whether there are older messages still to load.
@Getter
@AllArgsConstructor
public class PagedMessages {
    private List<MessageResponse> messages;
    private boolean hasMore;  // true = there are older messages available
}