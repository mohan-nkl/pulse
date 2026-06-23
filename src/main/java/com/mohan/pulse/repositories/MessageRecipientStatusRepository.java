package com.mohan.pulse.repositories;

import com.mohan.pulse.models.MessageRecipientStatus;
import com.mohan.pulse.models.MessageStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

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
}