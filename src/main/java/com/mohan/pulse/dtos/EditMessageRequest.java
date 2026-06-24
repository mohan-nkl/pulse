package com.mohan.pulse.dtos;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Body for PUT /api/messages/{id} — the new text for an edited message.
 */
@Getter
@Setter
@NoArgsConstructor
public class EditMessageRequest {
    private String content;
}