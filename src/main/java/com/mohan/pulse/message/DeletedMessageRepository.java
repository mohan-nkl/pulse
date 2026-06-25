package com.mohan.pulse.message;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DeletedMessageRepository extends JpaRepository<DeletedMessage, Long> {

    boolean existsByMessage_IdAndUser_Id(Long messageId, Long userId);

    List<DeletedMessage> findByUser_IdAndMessage_IdIn(Long userId, List<Long> messageIds);
}
