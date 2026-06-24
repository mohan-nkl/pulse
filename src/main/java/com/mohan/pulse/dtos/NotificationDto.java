package com.mohan.pulse.dtos;

import lombok.AllArgsConstructor;
import lombok.Getter;

/*
 * This is the data we send to the frontend when a new message arrives.
 * Think of it like a WhatsApp notification popup.
 */
@Getter
@AllArgsConstructor
public class NotificationDto {

    // Which conversation this message came from (e.g. "dm:1:2" or "group:5")
    private String conversationId;

    // Who sent the message (e.g. "John")
    private String senderName;

    // A short preview of the message (first 50 characters)
    private String preview;

    // How many unread messages in THIS specific conversation
    private int conversationUnread;

    // Total unread messages across ALL conversations (the number on the bell badge)
    private int totalUnread;
}