package com.mohan.pulse.status;

import com.mohan.pulse.user.User;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

@Entity
@Table(name = "status_views",
        // One row per (status, viewer) — a user can only "view" a status once.
        uniqueConstraints = @UniqueConstraint(
                name = "uq_status_viewer",
                columnNames = {"status_id", "viewer_id"}
        ))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class StatusView {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Which status was viewed
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "status_id", nullable = false)
    private Status status;

    // Who viewed it
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "viewer_id", nullable = false)
    private User viewer;

    // When they first opened it
    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant viewedAt;
}