package com.mohan.pulse.status;

import com.mohan.pulse.models.User;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

@Entity
@Table(name = "statuses",
        indexes = {
                @Index(name = "idx_status_author_expires", columnList = "author_id, expires_at")
        })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Status {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // The user who posted this status
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "author_id", nullable = false)
    private User author;

    // Text caption — optional when an image is present, required otherwise.
    // Max 700 chars like WhatsApp.
    @Column(length = 700)
    private String content;

    // URL of an uploaded image — null for text-only statuses.
    // Stored the same way as avatars (local disk for now, migratable to MinIO).
    @Column(name = "media_url")
    private String mediaUrl;

    // Auto-set to NOW() by Hibernate on insert
    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    // Set explicitly in the service to createdAt + 24 hours
    @Column(nullable = false)
    private Instant expiresAt;
}