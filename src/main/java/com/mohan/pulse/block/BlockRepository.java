package com.mohan.pulse.block;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface BlockRepository extends JpaRepository<Block, Long> {

    Optional<Block> findByBlocker_IdAndBlocked_Id(Long blockerId, Long blockedId);

    boolean existsByBlocker_IdAndBlocked_Id(Long blockerId, Long blockedId);

    List<Block> findByBlocker_Id(Long blockerId);

    @Query("SELECT b.blocked.id FROM Block b WHERE b.blocker.id = :blockerId")
    List<Long> findBlockedIdsByBlocker(@Param("blockerId") Long blockerId);

    @Query("SELECT b.blocker.id FROM Block b WHERE b.blocked.id = :blockedId")
    List<Long> findBlockerIdsByBlocked(@Param("blockedId") Long blockedId);

    @Query("""
        SELECT COUNT(b) > 0 FROM Block b
        WHERE (b.blocker.id = :firstUserId AND b.blocked.id = :secondUserId)
           OR (b.blocker.id = :secondUserId AND b.blocked.id = :firstUserId)
        """)
    boolean existsBlockBetween(@Param("firstUserId") Long firstUserId,
                               @Param("secondUserId") Long secondUserId);
}
