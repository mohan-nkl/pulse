package com.mohan.pulse.services;

import com.mohan.pulse.dtos.CreateStatusRequest;
import com.mohan.pulse.dtos.StatusResponse;
import com.mohan.pulse.exceptions.ApiException;
import com.mohan.pulse.models.Status;
import com.mohan.pulse.models.StatusView;
import com.mohan.pulse.models.User;
import com.mohan.pulse.repositories.ContactRepository;
import com.mohan.pulse.repositories.StatusRepository;
import com.mohan.pulse.repositories.StatusViewRepository;
import com.mohan.pulse.repositories.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StatusService {

    private final StatusRepository     statusRepository;
    private final StatusViewRepository statusViewRepository;
    private final UserRepository       userRepository;
    private final ContactRepository    contactRepository;

    @Value("${app.upload.status-dir}")
    private String statusDir;

    @Value("${app.upload.base-url}")
    private String baseUrl;

    private static final List<String> ALLOWED_IMAGE_TYPES =
            List.of("image/jpeg", "image/png", "image/webp", "image/gif");
    private static final long MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB

    // ── 1. Upload a status image ──────────────────────────────────────────────
    // Separate from createStatus so JSON and file data don't mix in one request.
    // Frontend calls this first, gets back a mediaUrl, then calls createStatus.

    public String uploadStatusMedia(Long userId, MultipartFile file) {
        if (file == null || file.isEmpty())
            throw new ApiException(HttpStatus.BAD_REQUEST, "File must not be empty.");
        if (file.getSize() > MAX_IMAGE_SIZE)
            throw new ApiException(HttpStatus.BAD_REQUEST, "Image must not exceed 10 MB.");
        if (!ALLOWED_IMAGE_TYPES.contains(file.getContentType()))
            throw new ApiException(HttpStatus.BAD_REQUEST, "Image must be JPEG, PNG, WebP, or GIF.");

        // userId prefix in the filename makes it easy to audit who uploaded what
        String filename = userId + "_" + UUID.randomUUID() + extension(file.getOriginalFilename());
        Path dir = Paths.get(statusDir);

        try {
            Files.createDirectories(dir);
            Files.write(dir.resolve(filename), file.getBytes());
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to save image.");
        }

        return baseUrl + "/status-media/" + filename;
    }

    // ── 2. Create a status ────────────────────────────────────────────────────
    // At least one of content or mediaUrl must be present.
    // expiresAt is always set to now + 24 hours.

    @Transactional
    public StatusResponse createStatus(Long authorId, CreateStatusRequest request) {
        // Validate: need at least text or an image
        boolean hasText  = request.getContent()  != null && !request.getContent().isBlank();
        boolean hasMedia = request.getMediaUrl() != null && !request.getMediaUrl().isBlank();

        if (!hasText && !hasMedia) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "A status must have text, an image, or both.");
        }

        User author = findUser(authorId);

        Status status = new Status();
        status.setAuthor(author);
        status.setContent(hasText  ? request.getContent().trim() : null);
        status.setMediaUrl(hasMedia ? request.getMediaUrl().trim() : null);
        status.setExpiresAt(Instant.now().plus(24, ChronoUnit.HOURS));

        return toResponse(statusRepository.save(status), authorId);
    }

    // ── 3. Get MY statuses ────────────────────────────────────────────────────
    // Returns own active (non-expired) statuses, newest first.
    // Each entry includes viewCount so the author can see who's watching.

    @Transactional(readOnly = true)
    public List<StatusResponse> getMyStatuses(Long userId) {
        return statusRepository
                .findByAuthorIdAndExpiresAtAfterOrderByCreatedAtDesc(userId, Instant.now())
                .stream()
                .map(s -> toResponse(s, userId))
                .collect(Collectors.toList());
    }

    // ── 4. Get CONTACT statuses ───────────────────────────────────────────────
    // Returns all non-expired statuses from users in the current user's contact list.
    // viewedByMe is set per-status so the frontend can show the unread ring.

    @Transactional(readOnly = true)
    public List<StatusResponse> getContactStatuses(Long userId) {
        List<Long> contactIds = contactRepository.findByOwner_Id(userId)
                .stream()
                .map(c -> c.getContact().getId())
                .collect(Collectors.toList());

        if (contactIds.isEmpty()) return List.of();

        return statusRepository
                .findActiveByAuthorIds(contactIds, Instant.now())
                .stream()
                .map(s -> toResponse(s, userId))
                .collect(Collectors.toList());
    }

    // ── 5. Record a view ──────────────────────────────────────────────────────
    // Idempotent — safe to call multiple times, only records the first view.
    // Authors viewing their own status don't count.

    @Transactional
    public void viewStatus(Long viewerId, Long statusId) {
        Status status = statusRepository.findById(statusId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Status not found."));

        if (status.getExpiresAt().isBefore(Instant.now()))
            throw new ApiException(HttpStatus.GONE, "This status has expired.");

        // Don't count the author viewing their own status
        if (status.getAuthor().getId().equals(viewerId)) return;

        // existsBy... hits the unique index — very fast, avoids a duplicate insert
        if (!statusViewRepository.existsByStatusIdAndViewerId(statusId, viewerId)) {
            StatusView view = new StatusView();
            view.setStatus(status);
            view.setViewer(findUser(viewerId));
            statusViewRepository.save(view);
        }
    }

    // ── 6. Delete a status ────────────────────────────────────────────────────
    // findByIdAndAuthorId ensures you can only delete your OWN statuses.
    // Returns 404 whether the status doesn't exist OR belongs to someone else
    // — deliberately doesn't distinguish, to avoid leaking IDs.

    @Transactional
    public void deleteStatus(Long authorId, Long statusId) {
        Status status = statusRepository.findByIdAndAuthorId(statusId, authorId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                        "Status not found or you are not the author."));
        statusRepository.delete(status);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private User findUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "User not found."));
    }

    private StatusResponse toResponse(Status status, Long currentUserId) {
        boolean isAuthor = status.getAuthor().getId().equals(currentUserId);

        // Only query viewCount when the current user is the author —
        // saves a DB call for every status in the contact feed.
        Long viewCount = isAuthor
                ? statusViewRepository.countByStatusId(status.getId())
                : null;

        // For your contacts' statuses: did I already open this one?
        boolean viewedByMe = !isAuthor &&
                statusViewRepository.existsByStatusIdAndViewerId(status.getId(), currentUserId);

        return StatusResponse.builder()
                .id(status.getId())
                .authorId(status.getAuthor().getId())
                .authorName(status.getAuthor().getName())
                .authorAvatarUrl(status.getAuthor().getAvatarUrl())
                .content(status.getContent())
                .mediaUrl(status.getMediaUrl())
                .createdAt(status.getCreatedAt())
                .expiresAt(status.getExpiresAt())
                .viewCount(viewCount)
                .viewedByMe(viewedByMe)
                .build();
    }

    private String extension(String filename) {
        if (filename == null || !filename.contains(".")) return ".jpg";
        return filename.substring(filename.lastIndexOf('.'));
    }
}