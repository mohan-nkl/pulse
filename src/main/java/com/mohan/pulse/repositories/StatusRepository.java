package com.mohan.pulse.repositories;

import com.mohan.pulse.models.Status;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface StatusRepository extends JpaRepository<Status, Long> {

    // All non-expired statuses posted by a given set of users (contact statuses feed).
    // Ordered newest-first so each author's latest status appears first.
    @Query("SELECT s FROM Status s WHERE s.author.id IN :authorIds AND s.expiresAt > :now ORDER BY s.createdAt DESC")
    List<Status> findActiveByAuthorIds(@Param("authorIds") List<Long> authorIds,
                                       @Param("now") Instant now);

    // All non-expired statuses posted by a single user (my own status view).
    // Oldest first so the viewer and right panel show chronological order.
    List<Status> findByAuthorIdAndExpiresAtAfterOrderByCreatedAtAsc(Long authorId, Instant now);

    // Used for authorization check before delete.
    // Returns the status only if it belongs to the given author.
    @Query("SELECT s FROM Status s WHERE s.id = :id AND s.author.id = :authorId")
    java.util.Optional<Status> findByIdAndAuthorId(@Param("id") Long id, @Param("authorId") Long authorId);
}