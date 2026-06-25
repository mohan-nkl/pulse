package com.mohan.pulse.message.dtos;

import com.mohan.pulse.message.MessageStatus;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class MessageStatusUpdate {

    private Long messageId;
    private String conversationId;
    private MessageStatus status;
    private int deliveredCount;
    private int readCount;
    private int totalRecipients;
}
