package com.mohan.pulse.call;

public enum CallMediaType {

    AUDIO,
    VIDEO;

    public static CallMediaType from(String raw) {
        if (raw == null) {
            return AUDIO;
        }
        try {
            return CallMediaType.valueOf(raw.trim().toUpperCase());
        }
        catch (IllegalArgumentException ex) {
            return AUDIO;
        }
    }
}