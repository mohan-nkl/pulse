package com.mohan.pulse.status;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface HiddenStatusRepository extends JpaRepository<HiddenStatus, Long> {

    List<HiddenStatus> findByViewer_IdAndStatus_IdIn(Long viewerId, List<Long> statusIds);

    void deleteByStatus_Id(Long statusId);
}