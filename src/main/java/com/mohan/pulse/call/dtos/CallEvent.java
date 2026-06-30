package com.mohan.pulse.call.dtos;

import lombok.Getter;

@Getter
public class CallEvent {

    private final Long fromUserId;
    private final String type;
    private final String callId;
    private final String callType;
    private final Object sdp;
    private final Object candidate;

    private final String callerName;
    private final String callerAvatar;

    private final String reason;

    private CallEvent(Long fromUserId, String type, String callId, String callType,
                      Object sdp, Object candidate, String callerName,
                      String callerAvatar, String reason) {
        this.fromUserId = fromUserId;
        this.type = type;
        this.callId = callId;
        this.callType = callType;
        this.sdp = sdp;
        this.candidate = candidate;
        this.callerName = callerName;
        this.callerAvatar = callerAvatar;
        this.reason = reason;
    }

    public static CallEvent offer(Long fromUserId, CallSignalRequest request,
                                  String callerName, String callerAvatar) {
        return new CallEvent(fromUserId, request.getType(), request.getCallId(),
                request.getCallType(), request.getSdp(), request.getCandidate(),
                callerName, callerAvatar, null);
    }

    public static CallEvent relayed(Long fromUserId, CallSignalRequest request) {
        return new CallEvent(fromUserId, request.getType(), request.getCallId(),
                request.getCallType(), request.getSdp(), request.getCandidate(),
                null, null, null);
    }

    public static CallEvent server(Long fromUserId, String type, String callId,
                                   String callType, String reason) {
        return new CallEvent(fromUserId, type, callId, callType,
                null, null, null, null, reason);
    }
}