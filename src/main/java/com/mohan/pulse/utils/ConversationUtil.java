package com.mohan.pulse.utils;

public final class ConversationUtil {

    private ConversationUtil() {
    }

    public static String dmConversationId(Long userIdA, Long userIdB) {
        long smaller = Math.min(userIdA, userIdB);
        long larger = Math.max(userIdA, userIdB);
        return "dm:" + smaller + ":" + larger;
    }

    public static String groupConversationId(Long groupId) {
        return "group:" + groupId;
    }
}