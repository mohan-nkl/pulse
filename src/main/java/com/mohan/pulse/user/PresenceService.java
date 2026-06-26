package com.mohan.pulse.user;

import com.mohan.pulse.block.BlockService;
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
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
public class PresenceService {

    private static final String PRESENCE_TOPIC = "/topic/presence";

    private final Map<Long, Integer> connections = new ConcurrentHashMap<>();

    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final BlockService blockService;

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

    public synchronized void userConnected(Long userId) {
        int currentConnectionCount = connections.getOrDefault(userId, 0);
        int newConnectionCount = currentConnectionCount + 1;
        connections.put(userId, newConnectionCount);

        boolean cameOnline = (currentConnectionCount == 0);
        if (cameOnline) {
            broadcast(new PresenceUpdate(userId, true, null));
        }
    }

    @Transactional
    public synchronized void userDisconnected(Long userId) {
        Integer currentConnectionCount = connections.get(userId);

        boolean notTracked = (currentConnectionCount == null);
        if (notTracked) {
            return;
        }

        boolean stillHasOtherConnections = (currentConnectionCount > 1);
        if (stillHasOtherConnections) {
            connections.put(userId, currentConnectionCount - 1);
            return;
        }

        connections.remove(userId);

        Instant now = Instant.now();
        markUserLastSeen(userId, now);
        broadcast(new PresenceUpdate(userId, false, now));
    }

    public synchronized void forceOffline(Long userId) {
        Integer previousCount = connections.remove(userId);

        boolean wasOnline = (previousCount != null);
        if (wasOnline) {
            broadcast(new PresenceUpdate(userId, false, Instant.now()));
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

        Instant lastSeen = lastSeenOf(userId);
        return new PresenceUpdate(userId, false, lastSeen);
    }

    @Transactional(readOnly = true)
    public PresenceUpdate getPresenceFor(Long viewerId, Long userId) {
        boolean hiddenByBlock = blockService.isBlockedBetween(viewerId, userId);
        if (hiddenByBlock) {
            return new PresenceUpdate(userId, false, null);
        }
        return getPresence(userId);
    }

    @Transactional(readOnly = true)
    public List<PresenceUpdate> getPresenceForViewer(Long viewerId, List<Long> userIds) {
        Set<Long> hiddenUserIds = collectHiddenUserIds(viewerId);
        Map<Long, Instant> lastSeenByUserId = loadLastSeenByUserId(userIds);

        List<PresenceUpdate> result = new ArrayList<>();
        for (Long userId : distinct(userIds)) {
            boolean hiddenByBlock = hiddenUserIds.contains(userId);

            if (hiddenByBlock) {
                result.add(new PresenceUpdate(userId, false, null));
            } else if (isOnline(userId)) {
                result.add(new PresenceUpdate(userId, true, null));
            } else {
                Instant lastSeen = lastSeenByUserId.get(userId);
                result.add(new PresenceUpdate(userId, false, lastSeen));
            }
        }
        return result;
    }

    private Set<Long> collectHiddenUserIds(Long viewerId) {
        Set<Long> hiddenUserIds = new HashSet<>();
        hiddenUserIds.addAll(blockService.blockersOf(viewerId));
        hiddenUserIds.addAll(blockService.blockedIdsOf(viewerId));
        return hiddenUserIds;
    }

    private Map<Long, Instant> loadLastSeenByUserId(List<Long> userIds) {
        Map<Long, Instant> lastSeenByUserId = new HashMap<>();
        List<User> users = userRepository.findAllById(userIds);
        for (User user : users) {
            lastSeenByUserId.put(user.getId(), user.getLastSeen());
        }
        return lastSeenByUserId;
    }

    private List<Long> distinct(List<Long> userIds) {
        List<Long> uniqueUserIds = new ArrayList<>();
        for (Long userId : userIds) {
            boolean alreadyAdded = uniqueUserIds.contains(userId);
            if (!alreadyAdded) {
                uniqueUserIds.add(userId);
            }
        }
        return uniqueUserIds;
    }

    private Instant lastSeenOf(Long userId) {
        Optional<User> maybeUser = userRepository.findById(userId);
        if (maybeUser.isEmpty()) {
            return null;
        }
        return maybeUser.get().getLastSeen();
    }

    private void markUserLastSeen(Long userId, Instant when) {
        Optional<User> maybeUser = userRepository.findById(userId);
        if (maybeUser.isPresent()) {
            User user = maybeUser.get();
            user.setLastSeen(when);
            userRepository.save(user);
        }
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