package com.mohan.pulse.user;

import com.mohan.pulse.user.dtos.UpdateProfileRequest;
import com.mohan.pulse.user.dtos.UserProfileResponse;
import com.mohan.pulse.common.ApiException;
import com.mohan.pulse.storage.StorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
public class UserProfileService {

    private final UserRepository userRepository;
    private final StorageService storageService;
    private final com.mohan.pulse.block.BlockService blockService;

    private static final List<String> ALLOWED_TYPES = List.of("image/jpeg", "image/png", "image/webp");
    private static final long MAX_SIZE = 5 * 1024 * 1024;

    public UserProfileResponse getMyProfile(Long userId) {
        return toResponse(findById(userId));
    }

    public UserProfileResponse getUserProfile(Long userId) {
        return toResponse(findById(userId));
    }

    /**
     * Profile as seen by a specific viewer. If the profile owner has blocked the
     * viewer, the viewer must not see the owner's avatar or last-seen.
     */
    public UserProfileResponse getUserProfileFor(Long viewerId, Long ownerId) {
        User owner = findById(ownerId);
        // Hide avatar + last-seen if there's a block in EITHER direction:
        // the blocked can't see the blocker, and you don't see those you blocked.
        boolean hidden = blockService.isBlockedBetween(viewerId, ownerId);

        return UserProfileResponse.builder()
                .id(owner.getId())
                .name(owner.getName())
                .about(owner.getAbout())
                .avatarUrl(hidden ? null : storageService.presignedUrl(owner.getAvatarUrl()))
                .lastSeen(hidden ? null : owner.getLastSeen())
                .createdAt(owner.getCreatedAt())
                .build();
    }

    public UserProfileResponse updateProfile(Long userId, UpdateProfileRequest request) {
        User user = findById(userId);

        if (request.getName() != null) user.setName(request.getName().trim());
        if (request.getAbout() != null) user.setAbout(request.getAbout().trim());

        return toResponse(userRepository.save(user));
    }

    public void recordLastSeen(Long userId) {
        User user = findById(userId);
        user.setLastSeen(Instant.now());
        userRepository.save(user);
    }

    /**
     * Upload an avatar to MinIO. Stores the object key on the user and returns
     * a presigned URL so the caller can display it immediately.
     */
    public String uploadAvatar(Long userId, MultipartFile file) {
        if (file == null || file.isEmpty())
            throw new ApiException(HttpStatus.BAD_REQUEST, "File must not be empty.");
        if (file.getSize() > MAX_SIZE)
            throw new ApiException(HttpStatus.BAD_REQUEST, "Avatar must not exceed 5 MB.");
        if (!ALLOWED_TYPES.contains(file.getContentType()))
            throw new ApiException(HttpStatus.BAD_REQUEST, "Avatar must be JPEG, PNG, or WebP.");

        User user = findById(userId);
        String key = storageService.upload("avatars", file);
        user.setAvatarUrl(key);          // store the KEY, not a URL
        userRepository.save(user);

        return storageService.presignedUrl(key);  // return a usable URL now
    }

    private User findById(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "User not found."));
    }

    private UserProfileResponse toResponse(User user) {
        return UserProfileResponse.builder()
                .id(user.getId())
                .name(user.getName())
                .about(user.getAbout())
                .avatarUrl(storageService.presignedUrl(user.getAvatarUrl()))  // presign on read
                .lastSeen(user.getLastSeen())
                .createdAt(user.getCreatedAt())
                .build();
    }
}