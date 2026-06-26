package com.mohan.pulse.message;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ClearedConversationRepository extends JpaRepository<ClearedConversation, Long> {

    Optional<ClearedConversation> findByUser_IdAndConversationId(Long userId, String conversationId);

    List<ClearedConversation> findByUser_Id(Long userId);
}