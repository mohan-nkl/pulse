package com.mohan.pulse.utils;

public final class ConversationUtil {

    private ConversationUtil() { }


    public static String dmConversationId(Long userIdA, Long userIdB) {
        long smaller = Math.min(userIdA, userIdB);
        long larger  = Math.max(userIdA, userIdB);
        return "dm:" + smaller + ":" + larger;
    }

    public static String groupConversationId(Long groupId) {
        return "group:" + groupId;
    }


    public static boolean isGroup(String conversationId) {
        return conversationId != null && conversationId.startsWith("group:");
    }

    public static boolean isDirect(String conversationId) {
        return conversationId != null && conversationId.startsWith("dm:");
    }

    public static Long groupIdFrom(String conversationId) {
        return Long.valueOf(conversationId.substring("group:".length()));
    }

    public static long[] dmParticipants(String conversationId) {
        String[] parts = conversationId.split(":");   // ["dm", "2", "7"]
        return new long[] { Long.parseLong(parts[1]), Long.parseLong(parts[2]) };
    }
}