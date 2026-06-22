package com.mohan.pulse.services;

import com.mohan.pulse.dtos.UpdateProfileRequest;
import com.mohan.pulse.dtos.UserProfileResponse;
import com.mohan.pulse.exceptions.ApiException;
import com.mohan.pulse.models.User;
import com.mohan.pulse.repositories.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserProfileService {

    private final UserRepository userRepository;

    @Value("${app.upload.avatar-dir}")
    private String avatarDir;

    @Value("${app.upload.base-url}")
    private String baseUrl;

    private static final List<String> ALLOWED_TYPES = List.of("image/jpeg", "image/png", "image/webp");
    private static final long MAX_SIZE = 5 * 1024 * 1024;

    public UserProfileResponse getMyProfile(Long userId) {
        return toResponse(findById(userId));
    }

    public UserProfileResponse getUserProfile(Long userId) {
        return toResponse(findById(userId));
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

    // TODO: avatar upload currently uses local disk storage — will be migrated to MinIO
    public String uploadAvatar(Long userId, MultipartFile file) {
        if (file == null || file.isEmpty())
            throw new ApiException(HttpStatus.BAD_REQUEST, "File must not be empty.");
        if (file.getSize() > MAX_SIZE)
            throw new ApiException(HttpStatus.BAD_REQUEST, "Avatar must not exceed 5 MB.");
        if (!ALLOWED_TYPES.contains(file.getContentType()))
            throw new ApiException(HttpStatus.BAD_REQUEST, "Avatar must be JPEG, PNG, or WebP.");

        User user = findById(userId);
        String filename = userId + "_" + UUID.randomUUID() + extension(file.getOriginalFilename());
        Path dir = Paths.get(avatarDir);

        try {
            Files.createDirectories(dir);
            Files.write(dir.resolve(filename), file.getBytes());
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to save avatar.");
        }

        String url = baseUrl + "/avatars/" + filename;
        user.setAvatarUrl(url);
        userRepository.save(user);
        return url;
    }

    private String extension(String filename) {
        if (filename == null || !filename.contains(".")) return ".jpg";
        return filename.substring(filename.lastIndexOf('.'));
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
                .avatarUrl(user.getAvatarUrl())
                .lastSeen(user.getLastSeen())
                .createdAt(user.getCreatedAt())
                .build();
    }
}