package com.mohan.pulse.call;

import com.mohan.pulse.block.BlockService;
import com.mohan.pulse.call.dtos.CallEvent;
import com.mohan.pulse.call.dtos.CallSignalRequest;
import com.mohan.pulse.contact.Contact;
import com.mohan.pulse.contact.ContactRepository;
import com.mohan.pulse.storage.StorageService;
import com.mohan.pulse.user.PresenceService;
import com.mohan.pulse.user.User;
import com.mohan.pulse.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.security.Principal;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;


@Service
@RequiredArgsConstructor
public class CallService {

    private static final String CALL_QUEUE = "/queue/call";
    private static final String DEFAULT_CALL_TYPE = "AUDIO";

    private final Map<Long, Long> engagedWith = new ConcurrentHashMap<>();

    private final SimpMessagingTemplate messagingTemplate;
    private final BlockService blockService;
    private final PresenceService presenceService;
    private final UserRepository userRepository;
    private final ContactRepository contactRepository;
    private final StorageService storageService;

    public void handleSignal(Long callerId, CallSignalRequest request) {
        if (request == null) {
            return;
        }

        Long peerId = request.getToUserId();
        boolean invalidTarget = (peerId == null || peerId.equals(callerId));
        if (invalidTarget) {
            return;
        }

        CallSignalType type = CallSignalType.from(request.getType());
        if (type == null) {
            return;
        }

        switch (type) {
            case OFFER   -> handleOffer(callerId, peerId, request);
            case HANGUP, REJECT, CANCEL -> handleTermination(callerId, peerId, request);
            case ANSWER, ICE -> relayIfPermitted(callerId, peerId, request);
            default -> { }
        }
    }

    private void handleOffer(Long callerId, Long calleeId, CallSignalRequest request) {
        boolean blocked = blockService.isBlockedBetween(callerId, calleeId);
        boolean offline = !presenceService.isOnline(calleeId);

        if (blocked || offline) {
            sendServer(callerId, callerId, CallSignalType.UNAVAILABLE, request);
            return;
        }

        if (isEngaged(calleeId)) {
            sendServer(callerId, calleeId, CallSignalType.BUSY, request);
            return;
        }

        engage(callerId, calleeId);
        relayOffer(callerId, calleeId, request);
    }

    private void relayOffer(Long callerId, Long calleeId, CallSignalRequest request) {
        String callerName = null;
        String callerAvatar = null;
        User caller = userRepository.findById(callerId).orElse(null);
        if (caller != null) {
            callerName = caller.getName();
            callerAvatar = storageService.presignedUrl(caller.getAvatarUrl());
        }

        String alias = contactRepository.findByOwner_IdAndContact_Id(calleeId, callerId)
                .map(Contact::getAlias)
                .filter(a -> a != null && !a.isBlank())
                .orElse(null);
        if (alias != null) {
            callerName = alias;
        }

        messagingTemplate.convertAndSendToUser(
                calleeId.toString(), CALL_QUEUE,
                CallEvent.offer(callerId, request, callerName, callerAvatar));
    }

    private void handleTermination(Long callerId, Long peerId, CallSignalRequest request) {
        disengage(callerId, peerId);
        relay(callerId, peerId, request);
    }

    private void relayIfPermitted(Long callerId, Long peerId, CallSignalRequest request) {
        if (blockService.isBlockedBetween(callerId, peerId)) {
            return;
        }
        relay(callerId, peerId, request);
    }

    private void relay(Long fromUserId, Long toUserId, CallSignalRequest request) {
        messagingTemplate.convertAndSendToUser(
                toUserId.toString(), CALL_QUEUE, CallEvent.relayed(fromUserId, request));
    }

    private void sendServer(Long toUserId, Long aboutUserId, CallSignalType type,
                            CallSignalRequest request) {
        String callType = (request != null && request.getCallType() != null)
                ? request.getCallType() : DEFAULT_CALL_TYPE;
        String callId = (request != null) ? request.getCallId() : null;

        messagingTemplate.convertAndSendToUser(
                toUserId.toString(), CALL_QUEUE,
                CallEvent.server(aboutUserId, type.name(), callId, callType, null));
    }


    public boolean isEngaged(Long userId) {
        return engagedWith.containsKey(userId);
    }

    private synchronized void engage(Long a, Long b) {
        engagedWith.put(a, b);
        engagedWith.put(b, a);
    }

    private synchronized void disengage(Long a, Long b) {
        if (b.equals(engagedWith.get(a))) {
            engagedWith.remove(a);
        }
        if (a.equals(engagedWith.get(b))) {
            engagedWith.remove(b);
        }
    }

    @EventListener
    public void onDisconnected(SessionDisconnectEvent event) {
        Long userId = userIdOf(event.getUser());
        if (userId == null) {
            return;
        }

        Long peerId = engagedWith.get(userId);
        if (peerId == null) {
            return;
        }

        disengage(userId, peerId);
        messagingTemplate.convertAndSendToUser(
                peerId.toString(), CALL_QUEUE,
                CallEvent.server(userId, CallSignalType.HANGUP.name(), null,
                        DEFAULT_CALL_TYPE, "peer-disconnected"));
    }

    private Long userIdOf(Principal principal) {
        if (principal == null) {
            return null;
        }
        try {
            return Long.valueOf(principal.getName());
        } catch (NumberFormatException ex) {
            return null;
        }
    }
}