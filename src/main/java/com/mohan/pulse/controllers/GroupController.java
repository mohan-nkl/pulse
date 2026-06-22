package com.mohan.pulse.controllers;

import com.mohan.pulse.dtos.AddMembersRequest;
import com.mohan.pulse.dtos.ApiResponse;
import com.mohan.pulse.dtos.CreateGroupRequest;
import com.mohan.pulse.dtos.GroupMemberResponse;
import com.mohan.pulse.dtos.GroupResponse;
import com.mohan.pulse.security.SecurityUtil;
import com.mohan.pulse.services.GroupService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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

    @PostMapping("/{groupId}/leave")
    public ApiResponse<Void> leaveGroup(@PathVariable Long groupId) {
        Long currentUserId = SecurityUtil.currentUserId();
        groupService.leaveGroup(currentUserId, groupId);
        return ApiResponse.ok("You left the group", null);
    }
}