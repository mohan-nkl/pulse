package com.mohan.pulse.reaction;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ReactionRepository extends JpaRepository<Reaction, Long> {

    List<Reaction> findByMessage_Id(Long messageId);

    List<Reaction> findByMessage_IdIn(List<Long> messageIds);

    Optional<Reaction> findByMessage_IdAndUser_Id(Long messageId, Long userId);
}
