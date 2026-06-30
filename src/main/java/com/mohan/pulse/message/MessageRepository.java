package com.mohan.pulse.message;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface MessageRepository extends JpaRepository<Message, Long> {

    List<Message> findByConversationIdOrderByCreatedAtDesc(
            String conversationId, Pageable pageable);

    List<Message> findByConversationIdAndIdLessThanOrderByCreatedAtDesc(
            String conversationId, Long beforeId, Pageable pageable);

    @Query("SELECT DISTINCT m.conversationId FROM Message m " +
            "WHERE m.sender.id = :userId AND m.conversationType = com.mohan.pulse.message.ConversationType.DIRECT")
    List<String> findDirectConversationIdsBySender(@Param("userId") Long userId);

    @Query("SELECT m.conversationId, MAX(m.createdAt) FROM Message m " +
            "WHERE m.conversationId IN :conversationIds GROUP BY m.conversationId")
    List<Object[]> findLastMessageTimes(@Param("conversationIds") Collection<String> conversationIds);

    @Query("SELECT m FROM Message m " +
            "WHERE m.type = com.mohan.pulse.message.MessageType.CALL " +
            "AND (m.conversationId LIKE :p1 OR m.conversationId LIKE :p2) " +
            "ORDER BY m.createdAt DESC")
    List<Message> findCallLogsForUser(@Param("p1") String p1, @Param("p2") String p2);
}