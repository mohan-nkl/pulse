package com.mohan.pulse.status;

import com.mohan.pulse.common.ApiResponse;
import com.mohan.pulse.message.dtos.ChatMessageResponse;
import com.mohan.pulse.status.dtos.CreateStatusRequest;
import com.mohan.pulse.status.dtos.StatusReplyRequest;
import com.mohan.pulse.status.dtos.StatusResponse;
import com.mohan.pulse.status.dtos.StatusViewerResponse;
import com.mohan.pulse.common.SecurityUtil;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/v1/statuses")
@RequiredArgsConstructor
public class StatusController {

    private final StatusService statusService;

    // POST /api/v1/statuses/upload
    // Step 1 of posting a status with an image.
    // Upload the image first → get back a mediaUrl → pass it to POST /statuses.
    @PostMapping("/upload")
    public ResponseEntity<ApiResponse<String>> uploadMedia(
            @RequestParam("file") MultipartFile file) {
        Long userId = SecurityUtil.currentUserId();
        String mediaUrl = statusService.uploadStatusMedia(userId, file);
        return ResponseEntity.ok(ApiResponse.ok("Image uploaded.", mediaUrl));
    }

    // POST /api/v1/statuses
    // Create a status. Body: { content?, mediaUrl? } — at least one required.
    @PostMapping
    public ResponseEntity<ApiResponse<StatusResponse>> createStatus(
            @Valid @RequestBody CreateStatusRequest request) {
        Long userId = SecurityUtil.currentUserId();
        StatusResponse response = statusService.createStatus(userId, request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Status posted.", response));
    }

    // GET /api/v1/statuses/mine
    // My own active statuses, newest first. Includes viewCount per status.
    @GetMapping("/mine")
    public ResponseEntity<ApiResponse<List<StatusResponse>>> getMyStatuses() {
        Long userId = SecurityUtil.currentUserId();
        return ResponseEntity.ok(ApiResponse.ok(statusService.getMyStatuses(userId)));
    }

    // GET /api/v1/statuses
    // All active statuses from my contacts. Includes viewedByMe per status.
    @GetMapping
    public ResponseEntity<ApiResponse<List<StatusResponse>>> getContactStatuses() {
        Long userId = SecurityUtil.currentUserId();
        return ResponseEntity.ok(ApiResponse.ok(statusService.getContactStatuses(userId)));
    }

    // POST /api/v1/statuses/{statusId}/view
    // Mark a status as viewed. Idempotent — safe to call multiple times.
    @PostMapping("/{statusId}/view")
    public ResponseEntity<ApiResponse<Void>> viewStatus(
            @PathVariable Long statusId) {
        Long userId = SecurityUtil.currentUserId();
        statusService.viewStatus(userId, statusId);
        return ResponseEntity.ok(ApiResponse.ok("Viewed.", null));
    }

    // GET /api/v1/statuses/{statusId}/viewers
    // Returns the list of users who viewed this status.
    // 403 if you're not the author.
    @GetMapping("/{statusId}/viewers")
    public ResponseEntity<ApiResponse<List<StatusViewerResponse>>> getViewers(
            @PathVariable Long statusId) {
        Long userId = SecurityUtil.currentUserId();
        return ResponseEntity.ok(ApiResponse.ok(statusService.getStatusViewers(userId, statusId)));
    }

    // POST /api/v1/statuses/{statusId}/reply
    // Send a DM reply to the status author. Uses the existing chat pipeline
    // so the author gets a real-time WebSocket notification.
    @PostMapping("/{statusId}/reply")
    public ResponseEntity<ApiResponse<ChatMessageResponse>> replyToStatus(
            @PathVariable Long statusId,
            @Valid @RequestBody StatusReplyRequest request) {
        Long userId = SecurityUtil.currentUserId();
        return ResponseEntity.ok(ApiResponse.ok("Reply sent.",
                statusService.replyToStatus(userId, statusId, request)));
    }

    // DELETE /api/v1/statuses/{statusId}
    // Delete your own status. 404 if it doesn't exist or isn't yours.
    @DeleteMapping("/{statusId}")
    public ResponseEntity<ApiResponse<Void>> deleteStatus(
            @PathVariable Long statusId) {
        Long userId = SecurityUtil.currentUserId();
        statusService.deleteStatus(userId, statusId);
        return ResponseEntity.ok(ApiResponse.ok("Status deleted.", null));
    }
}