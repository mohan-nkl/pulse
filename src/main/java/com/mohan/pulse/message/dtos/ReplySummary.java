package com.mohan.pulse.message.dtos;

import com.mohan.pulse.message.Message;
import com.mohan.pulse.message.MessageType;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class ReplySummary {

    private final Long replyToId;
    private final Long replyToSenderId;
    private final String replyToSenderName;
    private final String replyToContent;
    private final String replyToType;
    private final boolean replyToDeleted;

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
        } else if (replyTo.getType() != null && replyTo.getType() != MessageType.TEXT) {
            boolean noCaption = (replyTo.getContent() == null || replyTo.getContent().isBlank());
            if (noCaption) {
                preview = null;
            } else {
                preview = trim(replyTo.getContent());
            }
        } else {
            preview = trim(replyTo.getContent());
        }

        String replyToType = null;
        if (replyTo.getType() != null) {
            replyToType = replyTo.getType().name();
        }

        return new ReplySummary(
                replyTo.getId(),
                replyTo.getSender().getId(),
                replyTo.getSender().getName(),
                preview,
                replyToType,
                deleted);
    }

    private static String trim(String text) {
        if (text == null) {
            return null;
        }

        String stripped = text.strip();
        if (stripped.length() <= PREVIEW_MAX) {
            return stripped;
        }
        return stripped.substring(0, PREVIEW_MAX) + "…";
    }
}