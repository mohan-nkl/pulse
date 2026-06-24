package com.mohan.pulse.message;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

@Repository
public interface MessageRecipientStatusRepository
        extends JpaRepository<MessageRecipientStatus, Long> {

    List<MessageRecipientStatus> findByMessage_Id(Long messageId);

    List<MessageRecipientStatus> findByMessage_IdIn(List<Long> messageIds);

    List<MessageRecipientStatus> findByRecipient_IdAndStatus(
            Long recipientId, MessageStatus status);

    List<MessageRecipientStatus> findByRecipient_IdAndMessage_ConversationIdAndStatus(
            Long recipientId, String conversationId, MessageStatus status);

    List<MessageRecipientStatus> findByRecipient_IdAndMessage_ConversationIdAndStatusNot(
            Long recipientId, String conversationId, MessageStatus status);

    // ── Unread count per conversation ─────────────────────────────────────────
    // Returns one row per conversation: [conversationId (String), count (Long)].
    // "Unread" = any status that isn't READ (i.e. SENT or DELIVERED).
    // One query covers all conversations — no N+1.
    @Query("""
        SELECT mrs.message.conversationId, COUNT(mrs)
        FROM MessageRecipientStatus mrs
        WHERE mrs.recipient.id = :userId
          AND mrs.status <> com.mohan.pulse.models.MessageStatus.READ
        GROUP BY mrs.message.conversationId
        """)
    List<Object[]> countUnreadPerConversation(@Param("userId") Long userId);
}