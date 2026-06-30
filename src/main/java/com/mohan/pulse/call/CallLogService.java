package com.mohan.pulse.call;

import com.mohan.pulse.call.dtos.CallLogDto;
import com.mohan.pulse.call.dtos.RecordCallRequest;
import com.mohan.pulse.common.ApiException;
import com.mohan.pulse.common.ConversationUtil;
import com.mohan.pulse.contact.Contact;
import com.mohan.pulse.contact.ContactRepository;
import com.mohan.pulse.message.ConversationType;
import com.mohan.pulse.message.DeletedMessage;
import com.mohan.pulse.message.DeletedMessageRepository;
import com.mohan.pulse.message.Message;
import com.mohan.pulse.message.MessageRepository;
import com.mohan.pulse.message.MessageType;
import com.mohan.pulse.message.dtos.ChatMessageResponse;
import com.mohan.pulse.storage.StorageService;
import com.mohan.pulse.user.User;
import com.mohan.pulse.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class CallLogService {

    private static final String USER_QUEUE = "/queue/messages";
    private static final Set<String> VALID_STATUS = Set.of("COMPLETED", "MISSED", "DECLINED");
    private static final Set<String> VALID_MEDIA = Set.of("AUDIO", "VIDEO");

    private final UserRepository userRepository;
    private final MessageRepository messageRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final StorageService storageService;
    private final ContactRepository contactRepository;
    private final DeletedMessageRepository deletedMessageRepository;

    @Transactional
    public ChatMessageResponse recordCall(Long callerId, RecordCallRequest request) {
        if (request.getCalleeId() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Callee id is required.");
        }
        if (request.getCalleeId().equals(callerId)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "You cannot call yourself.");
        }

        String status = normalize(request.getStatus(), VALID_STATUS, "MISSED");
        String mediaType = normalize(request.getMediaType(), VALID_MEDIA, "AUDIO");
        int duration = request.getDurationSec() != null && request.getDurationSec() > 0
                ? request.getDurationSec() : 0;

        User caller = userRepository.findById(callerId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Caller not found."));
        User callee = userRepository.findById(request.getCalleeId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Callee not found."));

        String conversationId = ConversationUtil.dmConversationId(caller.getId(), callee.getId());

        Message message = new Message();
        message.setConversationId(conversationId);
        message.setConversationType(ConversationType.DIRECT);
        message.setSender(caller);
        message.setType(MessageType.CALL);
        message.setCallStatus(status);
        message.setCallMediaType(mediaType);
        message.setCallDurationSec(duration);

        Message saved = messageRepository.save(message);

        ChatMessageResponse response = toMessageResponse(saved, conversationId);

        sendTo(caller.getId(), response);
        sendTo(callee.getId(), response);

        return response;
    }

    @Transactional(readOnly = true)
    public List<CallLogDto> myCallLogs(Long userId) {
        String p1 = "dm:" + userId + ":%";
        String p2 = "%:" + userId;

        List<Message> calls = messageRepository.findCallLogsForUser(p1, p2);

        Set<Long> hidden = hiddenCallIds(userId, calls);

        List<CallLogDto> logs = new ArrayList<>();
        for (Message call : calls) {
            if (hidden.contains(call.getId())) {
                continue;
            }

            Long peerId = peerOf(call.getConversationId(), userId);
            if (peerId == null) {
                continue;
            }

            boolean iPlacedIt = call.getSender() != null
                    && userId.equals(call.getSender().getId());

            User peer = userRepository.findById(peerId).orElse(null);
            String peerName = displayNameFor(userId, peerId, peer);
            String peerAvatar = peer != null
                    ? storageService.presignedUrl(peer.getAvatarUrl()) : null;

            logs.add(CallLogDto.builder()
                    .id(call.getId())
                    .peerUserId(peerId)
                    .peerName(peerName)
                    .peerAvatarUrl(peerAvatar)
                    .direction(iPlacedIt ? "OUTGOING" : "INCOMING")
                    .mediaType(call.getCallMediaType())
                    .status(call.getCallStatus())
                    .durationSec(call.getCallDurationSec())
                    .createdAt(call.getCreatedAt())
                    .build());
        }
        return logs;
    }

    private Set<Long> hiddenCallIds(Long userId, List<Message> calls) {
        if (calls.isEmpty()) {
            return Set.of();
        }
        List<Long> ids = new ArrayList<>();
        for (Message call : calls) {
            ids.add(call.getId());
        }
        Set<Long> hidden = new HashSet<>();
        for (DeletedMessage deleted : deletedMessageRepository.findByUser_IdAndMessage_IdIn(userId, ids)) {
            hidden.add(deleted.getMessage().getId());
        }
        return hidden;
    }

    private String displayNameFor(Long viewerId, Long peerId, User peer) {
        String alias = contactRepository.findByOwner_IdAndContact_Id(viewerId, peerId)
                .map(Contact::getAlias)
                .filter(a -> a != null && !a.isBlank())
                .orElse(null);
        if (alias != null) {
            return alias;
        }
        return peer != null ? peer.getName() : ("User " + peerId);
    }

    private Long peerOf(String conversationId, Long userId) {
        if (!ConversationUtil.isDirect(conversationId)) {
            return null;
        }
        long[] participants = ConversationUtil.dmParticipants(conversationId);
        if (participants[0] == userId) {
            return participants[1];
        }
        if (participants[1] == userId) {
            return participants[0];
        }
        return null;
    }

    private ChatMessageResponse toMessageResponse(Message saved, String conversationId) {
        return ChatMessageResponse.builder()
                .id(saved.getId())
                .conversationId(conversationId)
                .senderId(saved.getSender().getId())
                .content(null)
                .createdAt(saved.getCreatedAt())
                .status("SENT")
                .type(MessageType.CALL.name())
                .callStatus(saved.getCallStatus())
                .callMediaType(saved.getCallMediaType())
                .callDurationSec(saved.getCallDurationSec())
                .edited(false)
                .deleted(false)
                .build();
    }

    private void sendTo(Long userId, ChatMessageResponse response) {
        messagingTemplate.convertAndSendToUser(userId.toString(), USER_QUEUE, response);
    }

    private String normalize(String raw, Set<String> allowed, String fallback) {
        if (raw == null) {
            return fallback;
        }
        String upper = raw.trim().toUpperCase();
        return allowed.contains(upper) ? upper : fallback;
    }
}