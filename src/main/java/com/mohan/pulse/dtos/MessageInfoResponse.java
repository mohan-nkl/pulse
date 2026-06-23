package com.mohan.pulse.dtos;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.List;


@Getter
@AllArgsConstructor
public class MessageInfoResponse {

    private Long messageId;
    private int totalRecipients;
    private int deliveredCount;
    private int readCount;
    private List<RecipientStatusEntry> recipients;  // one entry per person
}