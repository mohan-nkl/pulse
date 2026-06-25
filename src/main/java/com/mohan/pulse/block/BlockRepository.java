package com.mohan.pulse.block;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface BlockRepository extends JpaRepository<Block, Long> {

    Optional<Block> findByBlocker_IdAndBlocked_Id(Long blockerId, Long blockedId);

    boolean existsByBlocker_IdAndBlocked_Id(Long blockerId, Long blockedId);

    // Everyone the given user has blocked (for "blocked list" + group filtering).
    List<Block> findByBlocker_Id(Long blockerId);

    // The IDs the given user has blocked — handy for filtering group messages.
    @Query("SELECT b.blocked.id FROM Block b WHERE b.blocker.id = :blockerId")
    List<Long> findBlockedIdsByBlocker(@Param("blockerId") Long blockerId);

    // The IDs of users who have blocked the given user (the "blocked-by" set).
    @Query("SELECT b.blocker.id FROM Block b WHERE b.blocked.id = :blockedId")
    List<Long> findBlockerIdsByBlocked(@Param("blockedId") Long blockedId);

    /**
     * True if there is a block in EITHER direction between two users.
     * Used to decide whether a DM should be delivered: if A blocked B OR B
     * blocked A, the message must not reach the other side.
     */
    @Query("""
        SELECT COUNT(b) > 0 FROM Block b
        WHERE (b.blocker.id = :a AND b.blocked.id = :b)
           OR (b.blocker.id = :b AND b.blocked.id = :a)
        """)
    boolean existsBlockBetween(@Param("a") Long a, @Param("b") Long b);
}