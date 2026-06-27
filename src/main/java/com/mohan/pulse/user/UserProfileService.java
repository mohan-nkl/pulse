package com.mohan.pulse.user;

import com.mohan.pulse.block.BlockService;
import com.mohan.pulse.common.ApiException;
import com.mohan.pulse.contact.Contact;
import com.mohan.pulse.contact.ContactRepository;
import com.mohan.pulse.storage.StorageService;
import com.mohan.pulse.user.dtos.UpdateProfileRequest;
import com.mohan.pulse.user.dtos.UserProfileResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class UserProfileService {

    private final UserRepository userRepository;
    private final StorageService storageService;
    private final BlockService blockService;
    private final PresenceService presenceService;
    private final ContactRepository contactRepository;

    private static final List<String> ALLOWED_TYPES = List.of("image/jpeg", "image/png", "image/webp");
    private static final long MAX_SIZE = 5 * 1024 * 1024;

    public UserProfileResponse getMyProfile(Long userId) {
        User user = findById(userId);
        return toResponse(user);
    }

    public UserProfileResponse getUserProfileFor(Long viewerId, Long ownerId) {
        User owner = findById(ownerId);

        boolean hiddenByBlock = blockService.isBlockedBetween(viewerId, ownerId);

        String avatarUrl = null;
        Instant lastSeen = null;
        if (!hiddenByBlock) {
            avatarUrl = storageService.presignedUrl(owner.getAvatarUrl());
            lastSeen = owner.getLastSeen();
        }

        return new UserProfileResponse(
                owner.getId(),
                displayNameFor(viewerId, owner),
                owner.getAbout(),
                avatarUrl,
                lastSeen,
                owner.getCreatedAt());
    }

    private String displayNameFor(Long viewerId, User owner) {
        return contactRepository.findByOwner_IdAndContact_Id(viewerId, owner.getId())
                .map(Contact::getAlias)
                .filter(alias -> alias != null && !alias.isBlank())
                .orElse(owner.getPhone());
    }

    public UserProfileResponse updateProfile(Long userId, UpdateProfileRequest request) {
        User user = findById(userId);

        if (request.getName() != null) {
            user.setName(request.getName().trim());
        }
        if (request.getAbout() != null) {
            user.setAbout(request.getAbout().trim());
        }

        User savedUser = userRepository.save(user);
        return toResponse(savedUser);
    }

    public void recordLastSeen(Long userId) {
        User user = findById(userId);
        user.setLastSeen(Instant.now());
        userRepository.save(user);

        presenceService.forceOffline(userId);
    }

    public String uploadAvatar(Long userId, MultipartFile file) {
        boolean fileMissing = (file == null || file.isEmpty());
        if (fileMissing) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "File must not be empty.");
        }

        boolean tooLarge = file.getSize() > MAX_SIZE;
        if (tooLarge) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Avatar must not exceed 5 MB.");
        }

        boolean unsupportedType = !ALLOWED_TYPES.contains(file.getContentType());
        if (unsupportedType) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Avatar must be JPEG, PNG, or WebP.");
        }

        User user = findById(userId);
        String avatarKey = storageService.upload("avatars", file);
        user.setAvatarUrl(avatarKey);
        userRepository.save(user);

        return storageService.presignedUrl(avatarKey);
    }

    public UserProfileResponse removeAvatar(Long userId) {
        User user = findById(userId);
        user.setAvatarUrl(null);

        User savedUser = userRepository.save(user);
        return toResponse(savedUser);
    }

    private User findById(Long userId) {
        Optional<User> maybeUser = userRepository.findById(userId);
        if (maybeUser.isEmpty()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "User not found.");
        }
        return maybeUser.get();
    }

    private UserProfileResponse toResponse(User user) {
        return new UserProfileResponse(
                user.getId(),
                user.getName(),
                user.getAbout(),
                storageService.presignedUrl(user.getAvatarUrl()),
                user.getLastSeen(),
                user.getCreatedAt());
    }
}