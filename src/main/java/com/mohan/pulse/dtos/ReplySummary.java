package com.mohan.pulse.dtos;

import com.mohan.pulse.models.Message;

public record ReplySummary(
        Long replyToId,
        Long replyToSenderId,
        String replyToSenderName,
        String replyToContent,
        String replyToType,
        boolean replyToDeleted
) {

    private static final int PREVIEW_MAX = 80;

    public static final ReplySummary NONE =
            new ReplySummary(null, null, null, null, null, false);

    public static ReplySummary from(Message replyTo) {
        if (replyTo == null) {
            return NONE;
        }

        boolean deleted = replyTo.isDeleted();

        String preview;
        if (deleted) {
            preview = null;
        } else if (replyTo.getType() != null
                && replyTo.getType() != com.mohan.pulse.models.MessageType.TEXT) {
            preview = (replyTo.getContent() == null || replyTo.getContent().isBlank())
                    ? null
                    : trim(replyTo.getContent());
        } else {
            preview = trim(replyTo.getContent());
        }

        return new ReplySummary(
                replyTo.getId(),
                replyTo.getSender().getId(),
                replyTo.getSender().getName(),
                preview,
                replyTo.getType() != null ? replyTo.getType().name() : null,
                deleted
        );
    }

    private static String trim(String s) {
        if (s == null) return null;
        s = s.strip();
        return s.length() <= PREVIEW_MAX ? s : s.substring(0, PREVIEW_MAX) + "…";
    }
}