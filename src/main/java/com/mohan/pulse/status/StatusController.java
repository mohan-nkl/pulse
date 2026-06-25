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

    @PostMapping("/upload")
    public ResponseEntity<ApiResponse<String>> uploadMedia(
            @RequestParam("file") MultipartFile file) {
        Long userId = SecurityUtil.currentUserId();
        String mediaUrl = statusService.uploadStatusMedia(userId, file);
        return ResponseEntity.ok(ApiResponse.ok("Image uploaded.", mediaUrl));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<StatusResponse>> createStatus(
            @Valid @RequestBody CreateStatusRequest request) {
        Long userId = SecurityUtil.currentUserId();
        StatusResponse response = statusService.createStatus(userId, request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Status posted.", response));
    }

    @GetMapping("/mine")
    public ResponseEntity<ApiResponse<List<StatusResponse>>> getMyStatuses() {
        Long userId = SecurityUtil.currentUserId();
        return ResponseEntity.ok(ApiResponse.ok(statusService.getMyStatuses(userId)));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<StatusResponse>>> getContactStatuses() {
        Long userId = SecurityUtil.currentUserId();
        return ResponseEntity.ok(ApiResponse.ok(statusService.getContactStatuses(userId)));
    }

    @PostMapping("/{statusId}/view")
    public ResponseEntity<ApiResponse<Void>> viewStatus(
            @PathVariable Long statusId) {
        Long userId = SecurityUtil.currentUserId();
        statusService.viewStatus(userId, statusId);
        return ResponseEntity.ok(ApiResponse.ok("Viewed.", null));
    }

    @GetMapping("/{statusId}/viewers")
    public ResponseEntity<ApiResponse<List<StatusViewerResponse>>> getViewers(
            @PathVariable Long statusId) {
        Long userId = SecurityUtil.currentUserId();
        return ResponseEntity.ok(ApiResponse.ok(statusService.getStatusViewers(userId, statusId)));
    }

    @PostMapping("/{statusId}/reply")
    public ResponseEntity<ApiResponse<ChatMessageResponse>> replyToStatus(
            @PathVariable Long statusId,
            @Valid @RequestBody StatusReplyRequest request) {
        Long userId = SecurityUtil.currentUserId();
        return ResponseEntity.ok(ApiResponse.ok("Reply sent.",
                statusService.replyToStatus(userId, statusId, request)));
    }

    @DeleteMapping("/{statusId}")
    public ResponseEntity<ApiResponse<Void>> deleteStatus(
            @PathVariable Long statusId) {
        Long userId = SecurityUtil.currentUserId();
        statusService.deleteStatus(userId, statusId);
        return ResponseEntity.ok(ApiResponse.ok("Status deleted.", null));
    }
}
