package com.mohan.pulse.status;

import com.mohan.pulse.block.BlockService;
import com.mohan.pulse.common.ApiException;
import com.mohan.pulse.contact.Contact;
import com.mohan.pulse.contact.ContactRepository;
import com.mohan.pulse.message.ChatService;
import com.mohan.pulse.message.dtos.ChatMessageResponse;
import com.mohan.pulse.message.dtos.SendMessageRequest;
import com.mohan.pulse.status.dtos.CreateStatusRequest;
import com.mohan.pulse.status.dtos.StatusReplyRequest;
import com.mohan.pulse.status.dtos.StatusResponse;
import com.mohan.pulse.status.dtos.StatusViewEvent;
import com.mohan.pulse.status.dtos.StatusViewerResponse;
import com.mohan.pulse.storage.StorageService;
import com.mohan.pulse.user.User;
import com.mohan.pulse.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class StatusService {

    private final StatusRepository statusRepository;
    private final StatusViewRepository statusViewRepository;
    private final UserRepository userRepository;
    private final ContactRepository contactRepository;
    private final ChatService chatService;
    private final StorageService storageService;
    private final BlockService blockService;
    private final SimpMessagingTemplate messagingTemplate;

    private static final String STATUS_VIEWS_QUEUE = "/queue/status-views";

    private static final List<String> ALLOWED_MEDIA_TYPES = List.of(
            "image/jpeg", "image/png", "image/webp", "image/gif",
            "video/mp4", "video/webm", "video/quicktime", "video/ogg");
    private static final long MAX_MEDIA_SIZE = 20L * 1024 * 1024;

    public String uploadStatusMedia(Long userId, MultipartFile file) {
        boolean fileMissing = (file == null || file.isEmpty());
        if (fileMissing) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "File must not be empty.");
        }

        boolean tooLarge = file.getSize() > MAX_MEDIA_SIZE;
        if (tooLarge) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Status media must not exceed 20 MB.");
        }

        boolean unsupportedType = !ALLOWED_MEDIA_TYPES.contains(file.getContentType());
        if (unsupportedType) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Status media must be an image or a video.");
        }

        return storageService.upload("status", file);
    }

    @Transactional
    public StatusResponse createStatus(Long authorId, CreateStatusRequest request) {
        boolean hasText = (request.getContent() != null && !request.getContent().isBlank());
        boolean hasMedia = (request.getMediaUrl() != null && !request.getMediaUrl().isBlank());

        if (!hasText && !hasMedia) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "A status must have text, an image, or both.");
        }

        User author = findUserOrThrow(authorId);

        String content = null;
        if (hasText) {
            content = request.getContent().trim();
        }

        String mediaUrl = null;
        if (hasMedia) {
            mediaUrl = request.getMediaUrl().trim();
        }

        Instant expiresAt = Instant.now().plus(24, ChronoUnit.HOURS);

        Status status = new Status();
        status.setAuthor(author);
        status.setContent(content);
        status.setMediaUrl(mediaUrl);
        status.setExpiresAt(expiresAt);

        Status savedStatus = statusRepository.save(status);
        return toResponse(savedStatus, authorId);
    }

    @Transactional(readOnly = true)
    public List<StatusResponse> getMyStatuses(Long userId) {
        List<Status> statuses = statusRepository
                .findByAuthorIdAndExpiresAtAfterOrderByCreatedAtAsc(userId, Instant.now());
        return toResponses(statuses, userId);
    }

    @Transactional(readOnly = true)
    public List<StatusResponse> getContactStatuses(Long userId) {
        List<Long> contactIds = contactUserIdsOf(userId);
        if (contactIds.isEmpty()) {
            return List.of();
        }

        Set<Long> excludedIds = blockedOrBlockingIds(userId);

        List<Long> visibleAuthorIds = new ArrayList<>();
        for (Long contactId : contactIds) {
            boolean excluded = excludedIds.contains(contactId);
            if (!excluded) {
                visibleAuthorIds.add(contactId);
            }
        }

        if (visibleAuthorIds.isEmpty()) {
            return List.of();
        }

        List<Status> statuses = statusRepository.findActiveByAuthorIds(visibleAuthorIds, Instant.now());
        return toResponses(statuses, userId);
    }

    @Transactional
    public void viewStatus(Long viewerId, Long statusId) {
        Status status = findStatusOrThrow(statusId);

        boolean expired = status.getExpiresAt().isBefore(Instant.now());
        if (expired) {
            throw new ApiException(HttpStatus.GONE, "This status has expired.");
        }

        boolean viewerIsAuthor = status.getAuthor().getId().equals(viewerId);
        if (viewerIsAuthor) {
            return;
        }

        boolean alreadyViewed = statusViewRepository.existsByStatusIdAndViewerId(statusId, viewerId);
        if (alreadyViewed) {
            return;
        }

        StatusView view = new StatusView();
        view.setStatus(status);
        view.setViewer(findUserOrThrow(viewerId));
        statusViewRepository.save(view);

        Long authorId = status.getAuthor().getId();
        messagingTemplate.convertAndSendToUser(
                authorId.toString(), STATUS_VIEWS_QUEUE, new StatusViewEvent(statusId));
    }

    @Transactional(readOnly = true)
    public List<StatusViewerResponse> getStatusViewers(Long requesterId, Long statusId) {
        Status status = findStatusOrThrow(statusId);

        boolean requesterIsAuthor = status.getAuthor().getId().equals(requesterId);
        if (!requesterIsAuthor) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Only the author can see viewers.");
        }

        List<StatusView> views = statusViewRepository.findByStatusIdOrderByViewedAtDesc(statusId);

        List<StatusViewerResponse> responses = new ArrayList<>();
        for (StatusView view : views) {
            responses.add(toViewerResponse(view));
        }
        return responses;
    }

    @Transactional
    public ChatMessageResponse replyToStatus(Long replyerId, Long statusId, StatusReplyRequest request) {
        Status status = findStatusOrThrow(statusId);

        boolean expired = status.getExpiresAt().isBefore(Instant.now());
        if (expired) {
            throw new ApiException(HttpStatus.GONE, "This status has expired.");
        }

        boolean replyingToOwnStatus = status.getAuthor().getId().equals(replyerId);
        if (replyingToOwnStatus) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "You cannot reply to your own status.");
        }

        SendMessageRequest dmRequest = new SendMessageRequest();
        dmRequest.setReceiverId(status.getAuthor().getId());
        dmRequest.setContent(request.getContent());
        dmRequest.setReplyToStatusId(statusId);

        return chatService.sendDirectMessage(replyerId, dmRequest);
    }

    @Transactional
    public void deleteStatus(Long authorId, Long statusId) {
        Optional<Status> maybeStatus = statusRepository.findByIdAndAuthorId(statusId, authorId);
        if (maybeStatus.isEmpty()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Status not found or you are not the author.");
        }
        statusRepository.delete(maybeStatus.get());
    }

    private List<Long> contactUserIdsOf(Long ownerId) {
        List<Contact> contacts = contactRepository.findByOwner_Id(ownerId);

        List<Long> contactIds = new ArrayList<>();
        for (Contact contact : contacts) {
            contactIds.add(contact.getContact().getId());
        }
        return contactIds;
    }

    private Set<Long> blockedOrBlockingIds(Long userId) {
        Set<Long> excludedIds = new HashSet<>();
        excludedIds.addAll(blockService.blockedIdsOf(userId));
        excludedIds.addAll(blockService.blockersOf(userId));
        return excludedIds;
    }

    private List<StatusResponse> toResponses(List<Status> statuses, Long currentUserId) {
        List<StatusResponse> responses = new ArrayList<>();
        for (Status status : statuses) {
            responses.add(toResponse(status, currentUserId));
        }
        return responses;
    }

    private StatusViewerResponse toViewerResponse(StatusView view) {
        User viewer = view.getViewer();
        String avatarUrl = storageService.presignedUrl(viewer.getAvatarUrl());

        return new StatusViewerResponse(
                viewer.getId(),
                viewer.getName(),
                avatarUrl,
                view.getViewedAt());
    }

    private StatusResponse toResponse(Status status, Long currentUserId) {
        boolean isAuthor = status.getAuthor().getId().equals(currentUserId);

        Long viewCount = null;
        if (isAuthor) {
            viewCount = statusViewRepository.countByStatusId(status.getId());
        }

        boolean viewedByMe = false;
        if (!isAuthor) {
            viewedByMe = statusViewRepository.existsByStatusIdAndViewerId(status.getId(), currentUserId);
        }

        String authorAvatarUrl = storageService.presignedUrl(status.getAuthor().getAvatarUrl());
        String mediaUrl = storageService.presignedUrl(status.getMediaUrl());

        return StatusResponse.builder()
                .id(status.getId())
                .authorId(status.getAuthor().getId())
                .authorName(status.getAuthor().getName())
                .authorAvatarUrl(authorAvatarUrl)
                .content(status.getContent())
                .mediaUrl(mediaUrl)
                .createdAt(status.getCreatedAt())
                .expiresAt(status.getExpiresAt())
                .viewCount(viewCount)
                .viewedByMe(viewedByMe)
                .build();
    }

    private Status findStatusOrThrow(Long statusId) {
        Optional<Status> maybeStatus = statusRepository.findById(statusId);
        if (maybeStatus.isEmpty()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Status not found.");
        }
        return maybeStatus.get();
    }

    private User findUserOrThrow(Long userId) {
        Optional<User> maybeUser = userRepository.findById(userId);
        if (maybeUser.isEmpty()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "User not found.");
        }
        return maybeUser.get();
    }
}