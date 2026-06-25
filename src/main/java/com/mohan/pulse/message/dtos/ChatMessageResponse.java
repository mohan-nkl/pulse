package com.mohan.pulse.message.dtos;

import com.mohan.pulse.status.dtos.StatusPreviewDto;
import lombok.Builder;
import lombok.Getter;

import java.time.Instant;

@Getter
@Builder
public class ChatMessageResponse {

    private Long id;
    private String conversationId;
    private Long senderId;
    private String content;
    private Instant createdAt;

    private String status;

    private String type;
    private String mediaUrl;

    private Long replyToId;
    private Long replyToSenderId;
    private String replyToSenderName;
    private String replyToContent;
    private String replyToType;
    private boolean replyToDeleted;

    private StatusPreviewDto statusPreview;

    private boolean edited;
    private boolean deleted;
}