package com.mohan.pulse.user;

import com.mohan.pulse.user.dtos.PresenceUpdate;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.security.Principal;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;


@Service
@RequiredArgsConstructor
public class PresenceService {

    private static final String PRESENCE_TOPIC = "/topic/presence";

    private final Map<Long, Integer> connections = new ConcurrentHashMap<>();

    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final com.mohan.pulse.block.BlockService blockService;


    @EventListener
    public void onConnected(SessionConnectedEvent event) {
        Long userId = userIdOf(event.getUser());
        if (userId != null) {
            userConnected(userId);
        }
    }

    @EventListener
    public void onDisconnected(SessionDisconnectEvent event) {
        Long userId = userIdOf(event.getUser());
        if (userId != null) {
            userDisconnected(userId);
        }
    }

    public void userConnected(Long userId) {
        boolean cameOnline = connections.merge(userId, 1, Integer::sum) == 1;
        if (cameOnline) {
            broadcast(new PresenceUpdate(userId, true, null));
        }
    }

    @Transactional
    public void userDisconnected(Long userId) {
        boolean wentOffline =
                connections.computeIfPresent(userId, (id, count) -> count <= 1 ? null : count - 1) == null;

        if (wentOffline) {
            Instant now = Instant.now();
            userRepository.findById(userId).ifPresent(user -> {
                user.setLastSeen(now);
                userRepository.save(user);
            });
            broadcast(new PresenceUpdate(userId, false, now));
        }
    }

    public boolean isOnline(Long userId) {
        return connections.containsKey(userId);
    }


    @Transactional(readOnly = true)
    public PresenceUpdate getPresence(Long userId) {
        if (isOnline(userId)) {
            return new PresenceUpdate(userId, true, null);
        }
        Instant lastSeen = userRepository.findById(userId)
                .map(User::getLastSeen)
                .orElse(null);
        return new PresenceUpdate(userId, false, lastSeen);
    }

    /**
     * Presence of {@code userId} as seen by {@code viewerId}. If {@code userId}
     * has blocked the viewer, the viewer always sees them as offline with no
     * last-seen.
     */
    @Transactional(readOnly = true)
    public PresenceUpdate getPresenceFor(Long viewerId, Long userId) {
        if (blockService.isBlockedBetween(viewerId, userId)) {
            return new PresenceUpdate(userId, false, null);
        }
        return getPresence(userId);
    }

    @Transactional(readOnly = true)
    public List<PresenceUpdate> getPresenceForViewer(Long viewerId, List<Long> userIds) {
        // Anyone in a block with the viewer (either direction) is shown offline.
        var hiddenIds = new java.util.HashSet<Long>();
        hiddenIds.addAll(blockService.blockersOf(viewerId));   // they blocked me
        hiddenIds.addAll(blockService.blockedIdsOf(viewerId)); // I blocked them

        Map<Long, Instant> lastSeenById = new HashMap<>();
        userRepository.findAllById(userIds)
                .forEach(user -> lastSeenById.put(user.getId(), user.getLastSeen()));

        return userIds.stream()
                .distinct()
                .map(id -> {
                    if (hiddenIds.contains(id)) {
                        return new PresenceUpdate(id, false, null);
                    }
                    return isOnline(id)
                            ? new PresenceUpdate(id, true, null)
                            : new PresenceUpdate(id, false, lastSeenById.get(id));
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public List<PresenceUpdate> getPresenceFor(List<Long> userIds) {
        Map<Long, Instant> lastSeenById = new HashMap<>();
        userRepository.findAllById(userIds)
                .forEach(user -> lastSeenById.put(user.getId(), user.getLastSeen()));

        return userIds.stream()
                .distinct()
                .map(id -> isOnline(id)
                        ? new PresenceUpdate(id, true, null)
                        : new PresenceUpdate(id, false, lastSeenById.get(id)))
                .toList();
    }


    private void broadcast(PresenceUpdate update) {
        messagingTemplate.convertAndSend(PRESENCE_TOPIC, update);
    }

    private Long userIdOf(Principal principal) {
        if (principal == null) {
            return null;
        }
        try {
            return Long.valueOf(principal.getName());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}