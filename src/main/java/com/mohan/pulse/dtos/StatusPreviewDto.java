package com.mohan.pulse.dtos;

import lombok.Builder;
import lombok.Getter;

// A compact snapshot of a status attached to a reply message.
// Shown as a small preview card above the reply text in chat.
// Null fields are fine — a text-only status has no mediaUrl, image-only has no content.
@Getter
@Builder
public class StatusPreviewDto {
    private String authorName;
    private String content;   // null for image-only statuses
    private String mediaUrl;  // null for text-only statuses
}