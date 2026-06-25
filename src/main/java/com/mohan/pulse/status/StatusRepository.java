package com.mohan.pulse.status;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface StatusRepository extends JpaRepository<Status, Long> {

    @Query("SELECT s FROM Status s WHERE s.author.id IN :authorIds AND s.expiresAt > :now ORDER BY s.createdAt DESC")
    List<Status> findActiveByAuthorIds(@Param("authorIds") List<Long> authorIds,
                                       @Param("now") Instant now);

    List<Status> findByAuthorIdAndExpiresAtAfterOrderByCreatedAtAsc(Long authorId, Instant now);

    @Query("SELECT s FROM Status s WHERE s.id = :id AND s.author.id = :authorId")
    java.util.Optional<Status> findByIdAndAuthorId(@Param("id") Long id, @Param("authorId") Long authorId);
}
