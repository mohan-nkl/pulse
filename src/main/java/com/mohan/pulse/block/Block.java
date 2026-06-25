package com.mohan.pulse.block;

import com.mohan.pulse.user.User;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/**
 * A directional block: {@code blocker} has blocked {@code blocked}.
 *
 * Kept in its own table (not on Contact) because a block is independent of the
 * contact list — you can block someone who isn't a contact, and the block must
 * persist regardless of contact changes.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "blocks",
        uniqueConstraints = @UniqueConstraint(
                columnNames = {"blocker_id", "blocked_id"}))
public class Block {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "blocker_id", nullable = false)
    private User blocker;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "blocked_id", nullable = false)
    private User blocked;

    @CreationTimestamp
    @Column(updatable = false)
    private Instant createdAt;
}