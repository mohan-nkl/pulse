package com.mohan.pulse.user;

import com.mohan.pulse.common.ApiResponse;
import com.mohan.pulse.user.dtos.UpdateProfileRequest;
import com.mohan.pulse.user.dtos.UserProfileResponse;
import com.mohan.pulse.common.SecurityUtil;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class UserProfileController {

    private final UserProfileService userProfileService;

    @GetMapping("/profile")
    public ResponseEntity<ApiResponse<UserProfileResponse>> getMyProfile() {
        Long userId = SecurityUtil.currentUserId();
        return ResponseEntity.ok(ApiResponse.ok(userProfileService.getMyProfile(userId)));
    }

    @PutMapping("/profile")
    public ResponseEntity<ApiResponse<UserProfileResponse>> updateProfile(
            @Valid @RequestBody UpdateProfileRequest request) {
        Long userId = SecurityUtil.currentUserId();
        return ResponseEntity.ok(ApiResponse.ok("Profile updated.", userProfileService.updateProfile(userId, request)));
    }

    // TODO: avatar upload currently uses local disk storage — will be migrated to MinIO
    @PostMapping("/profile/avatar")
    public ResponseEntity<ApiResponse<String>> uploadAvatar(
            @RequestParam("file") MultipartFile file) {
        Long userId = SecurityUtil.currentUserId();
        return ResponseEntity.ok(ApiResponse.ok("Avatar updated.", userProfileService.uploadAvatar(userId, file)));
    }

    @GetMapping("/users/{userId}/profile")
    public ResponseEntity<ApiResponse<UserProfileResponse>> getUserProfile(
            @PathVariable Long userId) {
        Long viewerId = SecurityUtil.currentUserId();
        return ResponseEntity.ok(ApiResponse.ok(
                userProfileService.getUserProfileFor(viewerId, userId)));
    }

    @PostMapping("/auth/logout")
    public ResponseEntity<ApiResponse<Void>> logout() {
        Long userId = SecurityUtil.currentUserId();
        userProfileService.recordLastSeen(userId);
        return ResponseEntity.ok(ApiResponse.ok("Logged out.", null));
    }
}