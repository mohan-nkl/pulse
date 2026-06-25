package com.mohan.pulse.message;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MessageRepository extends JpaRepository<Message, Long> {

    List<Message> findByConversationIdOrderByCreatedAtAsc(String conversationId);

    List<Message> findByConversationIdOrderByCreatedAtDesc(
            String conversationId, Pageable pageable);

    List<Message> findByConversationIdAndIdLessThanOrderByCreatedAtDesc(
            String conversationId, Long beforeId, Pageable pageable);

    @Query("SELECT DISTINCT m.conversationId FROM Message m " +
           "WHERE m.sender.id = :userId AND m.conversationType = com.mohan.pulse.message.ConversationType.DIRECT")
    List<String> findDirectConversationIdsBySender(@Param("userId") Long userId);
}
