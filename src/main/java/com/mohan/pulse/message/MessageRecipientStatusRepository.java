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

    @Query("""
        SELECT mrs.message.conversationId, COUNT(mrs)
        FROM MessageRecipientStatus mrs
        WHERE mrs.recipient.id = :userId
          AND mrs.status <> com.mohan.pulse.message.MessageStatus.READ
        GROUP BY mrs.message.conversationId
        """)
    List<Object[]> countUnreadPerConversation(@Param("userId") Long userId);

    @Query("""
        SELECT DISTINCT mrs.message.conversationId
        FROM MessageRecipientStatus mrs
        WHERE mrs.recipient.id = :userId
          AND mrs.message.conversationType = com.mohan.pulse.message.ConversationType.DIRECT
        """)
    List<String> findDirectConversationIdsForRecipient(@Param("userId") Long userId);

    @Query("""
        SELECT mrs.message.id
        FROM MessageRecipientStatus mrs
        WHERE mrs.recipient.id = :recipientId
          AND mrs.message.id IN :messageIds
        """)
    List<Long> findDeliveredMessageIds(@Param("recipientId") Long recipientId,
                                       @Param("messageIds") List<Long> messageIds);
}
