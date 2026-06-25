package com.mohan.pulse.message.dtos;

import com.mohan.pulse.message.MessageStatus;
import com.mohan.pulse.reaction.dtos.ReactionEntry;
import com.mohan.pulse.status.dtos.StatusPreviewDto;
import lombok.Builder;
import lombok.Getter;

import java.time.Instant;
import java.util.List;

@Getter
@Builder
public class MessageResponse {

    private Long id;
    private Long senderId;
    private String content;
    private Instant createdAt;
    private MessageStatus status;
    private int deliveredCount;
    private int readCount;
    private int totalRecipients;

    private String type;
    private String mediaUrl;

    private Long replyToId;
    private Long replyToSenderId;
    private String replyToSenderName;
    private String replyToContent;
    private String replyToType;
    private boolean replyToDeleted;

    private List<ReactionEntry> reactions;

    private StatusPreviewDto statusPreview;

    private boolean edited;
    private boolean deleted;
}