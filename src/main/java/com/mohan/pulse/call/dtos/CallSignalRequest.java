package com.mohan.pulse.call.dtos;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class CallSignalRequest {

    private Long toUserId;
    private String type;
    private String callId;
    private String callType;
    private Object sdp;
    private Object candidate;
}