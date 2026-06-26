package com.mohan.pulse.group;

import com.mohan.pulse.group.dtos.AddMembersRequest;
import com.mohan.pulse.common.ApiResponse;
import com.mohan.pulse.group.dtos.CreateGroupRequest;
import com.mohan.pulse.group.dtos.GroupMemberResponse;
import com.mohan.pulse.group.dtos.GroupResponse;
import com.mohan.pulse.group.dtos.UpdateGroupRequest;
import com.mohan.pulse.common.SecurityUtil;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/groups")
@RequiredArgsConstructor
public class GroupController {

    private final GroupService groupService;

    @PostMapping
    public ApiResponse<GroupResponse> createGroup(@Valid @RequestBody CreateGroupRequest request) {
        Long currentUserId = SecurityUtil.currentUserId();
        GroupResponse group = groupService.createGroup(currentUserId, request);
        return ApiResponse.ok("Group created", group);
    }

    @GetMapping
    public ApiResponse<List<GroupResponse>> listMyGroups() {
        Long currentUserId = SecurityUtil.currentUserId();
        return ApiResponse.ok(groupService.listMyGroups(currentUserId));
    }

    @GetMapping("/{groupId}/members")
    public ApiResponse<List<GroupMemberResponse>> getMembers(@PathVariable Long groupId) {
        Long currentUserId = SecurityUtil.currentUserId();
        return ApiResponse.ok(groupService.getMembers(currentUserId, groupId));
    }

    @PostMapping("/{groupId}/members")
    public ApiResponse<List<GroupMemberResponse>> addMembers(
            @PathVariable Long groupId,
            @Valid @RequestBody AddMembersRequest request) {

        Long currentUserId = SecurityUtil.currentUserId();
        return ApiResponse.ok("Members added", groupService.addMembers(currentUserId, groupId, request));
    }

    @DeleteMapping("/{groupId}/members/{userId}")
    public ApiResponse<List<GroupMemberResponse>> removeMember(
            @PathVariable Long groupId,
            @PathVariable Long userId) {

        Long currentUserId = SecurityUtil.currentUserId();
        return ApiResponse.ok("Member removed", groupService.removeMember(currentUserId, groupId, userId));
    }

    @PostMapping("/{groupId}/admins/{userId}")
    public ApiResponse<List<GroupMemberResponse>> makeAdmin(
            @PathVariable Long groupId,
            @PathVariable Long userId) {

        Long currentUserId = SecurityUtil.currentUserId();
        return ApiResponse.ok("Member promoted to admin", groupService.makeAdmin(currentUserId, groupId, userId));
    }

    @DeleteMapping("/{groupId}/admins/{userId}")
    public ApiResponse<List<GroupMemberResponse>> dismissAdmin(
            @PathVariable Long groupId,
            @PathVariable Long userId) {

        Long currentUserId = SecurityUtil.currentUserId();
        return ApiResponse.ok("Admin dismissed", groupService.demoteAdmin(currentUserId, groupId, userId));
    }

    @PostMapping("/{groupId}/leave")
    public ApiResponse<Void> leaveGroup(@PathVariable Long groupId) {
        Long currentUserId = SecurityUtil.currentUserId();
        groupService.leaveGroup(currentUserId, groupId);
        return ApiResponse.ok("You left the group", null);
    }

    @PutMapping("/{groupId}")
    public ApiResponse<GroupResponse> updateGroup(
            @PathVariable Long groupId,
            @Valid @RequestBody UpdateGroupRequest request) {

        Long currentUserId = SecurityUtil.currentUserId();
        return ApiResponse.ok("Group updated", groupService.updateGroup(currentUserId, groupId, request));
    }

    @PostMapping("/{groupId}/avatar")
    public ApiResponse<GroupResponse> updateGroupAvatar(
            @PathVariable Long groupId,
            @RequestParam("file") MultipartFile file) {

        Long currentUserId = SecurityUtil.currentUserId();
        return ApiResponse.ok("Group photo updated", groupService.updateGroupAvatar(currentUserId, groupId, file));
    }

    @DeleteMapping("/{groupId}/avatar")
    public ApiResponse<GroupResponse> removeGroupAvatar(@PathVariable Long groupId) {
        Long currentUserId = SecurityUtil.currentUserId();
        return ApiResponse.ok("Group photo removed", groupService.removeGroupAvatar(currentUserId, groupId));
    }
}
