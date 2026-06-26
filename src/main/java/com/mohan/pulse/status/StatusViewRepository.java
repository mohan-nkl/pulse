package com.mohan.pulse.status;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface StatusViewRepository extends JpaRepository<StatusView, Long> {

    long countByStatusId(Long statusId);

    void deleteByStatusId(Long statusId);

    boolean existsByStatusIdAndViewerId(Long statusId, Long viewerId);

    List<StatusView> findByStatusIdOrderByViewedAtDesc(Long statusId);
}
