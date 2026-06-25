package com.mohan.pulse.notification.dtos;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class NotificationDto {

    private String type;

    private String conversationId;

    private String senderName;

    private String preview;

    private int conversationUnread;

    private int totalUnread;
}
