package com.mohan.pulse.dtos;

import com.mohan.pulse.models.MessageStatus;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.Instant;
import java.util.List;

@Getter
@AllArgsConstructor
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
}