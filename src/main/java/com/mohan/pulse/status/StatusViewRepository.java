package com.mohan.pulse.status;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface StatusViewRepository extends JpaRepository<StatusView, Long> {

    // How many people have viewed a given status
    long countByStatusId(Long statusId);

    // Did a specific user already view a specific status?
    boolean existsByStatusIdAndViewerId(Long statusId, Long viewerId);

    // All viewers of a given status (for "Seen by" list shown to the author)
    List<StatusView> findByStatusIdOrderByViewedAtDesc(Long statusId);
}