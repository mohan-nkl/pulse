package com.mohan.pulse.repositories;

import com.mohan.pulse.models.Message;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MessageRepository extends JpaRepository<Message, Long> {

    // ── Legacy (still used by search / other callers if any) ──────────────────
    List<Message> findByConversationIdOrderByCreatedAtAsc(String conversationId);

    // ── Pagination query 1: newest batch ──────────────────────────────────────
    // Returns up to `limit` messages, newest first.
    // Pageable carries only the LIMIT — we always pass PageRequest.of(0, limit).
    // Service reverses the list to restore chronological order.
    List<Message> findByConversationIdOrderByCreatedAtDesc(
            String conversationId, Pageable pageable);

    // ── Pagination query 2: older than a given message ────────────────────────
    // Returns up to `limit` messages with id < beforeId, newest-of-those first.
    // Service reverses to restore chronological order.
    // This is cursor-based: the cursor is a message ID, not a page number.
    // Advantage over page numbers: inserting new messages never shifts pages.
    List<Message> findByConversationIdAndIdLessThanOrderByCreatedAtDesc(
            String conversationId, Long beforeId, Pageable pageable);
}