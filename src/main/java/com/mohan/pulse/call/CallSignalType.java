package com.mohan.pulse.call;

public enum CallSignalType {

    OFFER,
    ANSWER,
    ICE,
    HANGUP,
    REJECT,
    CANCEL,
    BUSY,
    UNAVAILABLE;

    public static CallSignalType from(String raw) {
        if (raw == null) {
            return null;
        }
        try {
            return CallSignalType.valueOf(raw.trim().toUpperCase());
        }
        catch (IllegalArgumentException ex) {
            return null;
        }
    }
}