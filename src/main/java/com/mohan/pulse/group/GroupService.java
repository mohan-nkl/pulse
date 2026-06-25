package com.mohan.pulse.group;

import com.mohan.pulse.group.dtos.AddMembersRequest;
import com.mohan.pulse.group.dtos.CreateGroupRequest;
import com.mohan.pulse.group.dtos.GroupMemberResponse;
import com.mohan.pulse.group.dtos.GroupResponse;
import com.mohan.pulse.common.ApiException;
import com.mohan.pulse.user.User;
import com.mohan.pulse.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class GroupService {

    private final GroupRepository groupRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final UserRepository userRepository;
    private final com.mohan.pulse.storage.StorageService storageService;

    @Transactional
    public GroupResponse createGroup(Long creatorId, CreateGroupRequest request) {

        User creator = findUser(creatorId);

        Group group = new Group();
        group.setName(request.getName());
        group.setCreatedBy(creator);
        Group savedGroup = groupRepository.save(group);

        addMembership(savedGroup, creator, GroupRole.ADMIN);

        if (request.getMemberIds() != null) {
            for (Long memberId : request.getMemberIds()) {
                boolean isCreator = memberId.equals(creatorId);
                boolean alreadyMember =
                        groupMemberRepository.existsByGroupIdAndUserId(savedGroup.getId(), memberId);

                if (!isCreator && !alreadyMember) {
                    addMembership(savedGroup, findUser(memberId), GroupRole.MEMBER);
                }
            }
        }

        int memberCount = groupMemberRepository.findByGroupId(savedGroup.getId()).size();
        return toGroupResponse(savedGroup, GroupRole.ADMIN, memberCount);
    }

    @Transactional(readOnly = true)
    public List<GroupResponse> listMyGroups(Long userId) {

        return groupMemberRepository.findByUserId(userId)
                .stream()
                .map(membership -> {
                    Group group = membership.getGroup();
                    int memberCount = groupMemberRepository.findByGroupId(group.getId()).size();
                    return toGroupResponse(group, membership.getRole(), memberCount);
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public List<GroupMemberResponse> getMembers(Long actorId, Long groupId) {

        requireMembership(groupId, actorId); // must be in the group to see its members

        return groupMemberRepository.findByGroupId(groupId)
                .stream()
                .map(this::toMemberResponse)
                .toList();
    }

    @Transactional
    public List<GroupMemberResponse> addMembers(Long actorId, Long groupId, AddMembersRequest request) {

        requireAdmin(actorId, groupId);
        Group group = findGroup(groupId);

        for (Long memberId : request.getMemberIds()) {
            boolean alreadyMember =
                    groupMemberRepository.existsByGroupIdAndUserId(groupId, memberId);

            if (!alreadyMember) {
                addMembership(group, findUser(memberId), GroupRole.MEMBER);
            }
        }

        return getMembers(actorId, groupId);
    }

    @Transactional
    public List<GroupMemberResponse> removeMember(Long actorId, Long groupId, Long targetUserId) {

        requireAdmin(actorId, groupId);

        if (targetUserId.equals(actorId)) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "To leave the group, use leave — not remove.");
        }

        GroupMember target = requireMembership(groupId, targetUserId);
        groupMemberRepository.delete(target);

        return getMembers(actorId, groupId);
    }

    @Transactional
    public void leaveGroup(Long actorId, Long groupId) {

        GroupMember membership = requireMembership(groupId, actorId);
        groupMemberRepository.delete(membership);

        List<GroupMember> remaining = groupMemberRepository.findByGroupId(groupId);

        if (remaining.isEmpty()) {
            groupRepository.deleteById(groupId);
            return;
        }

        boolean hasAdmin = remaining.stream()
                .anyMatch(member -> member.getRole() == GroupRole.ADMIN);

        if (!hasAdmin) {
            GroupMember earliest = remaining.stream()
                    .min(Comparator.comparing(GroupMember::getJoinedAt))
                    .orElseThrow(); // 'remaining' is non-empty, so this is always present
            earliest.setRole(GroupRole.ADMIN);
            groupMemberRepository.save(earliest);
        }
    }

    @Transactional
    public List<GroupMemberResponse> makeAdmin(Long actorId, Long groupId, Long targetUserId) {

        requireAdmin(actorId, groupId);

        GroupMember target = requireMembership(groupId, targetUserId);
        target.setRole(GroupRole.ADMIN);
        groupMemberRepository.save(target);

        return getMembers(actorId, groupId);
    }


    private Group findGroup(Long groupId) {
        return groupRepository.findById(groupId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Group not found"));
    }

    private User findUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "User not found"));
    }

    private GroupMember requireMembership(Long groupId, Long userId) {
        return groupMemberRepository.findByGroupIdAndUserId(groupId, userId)
                .orElseThrow(() -> new ApiException(HttpStatus.FORBIDDEN,
                        "You are not a member of this group."));
    }

    private void requireAdmin(Long actorId, Long groupId) {
        GroupMember membership = requireMembership(groupId, actorId);
        if (membership.getRole() != GroupRole.ADMIN) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Only an admin can do that.");
        }
    }

    private GroupMember addMembership(Group group, User user, GroupRole role) {
        GroupMember member = new GroupMember();
        member.setGroup(group);
        member.setUser(user);
        member.setRole(role);
        return groupMemberRepository.save(member);
    }

    private GroupMemberResponse toMemberResponse(GroupMember member) {
        User user = member.getUser();
        return new GroupMemberResponse(
                user.getId(),
                user.getName(),
                storageService.presignedUrl(user.getAvatarUrl()),
                member.getRole());
    }

    private GroupResponse toGroupResponse(Group group, GroupRole myRole, int memberCount) {
        return new GroupResponse(
                group.getId(),
                group.getName(),
                storageService.presignedUrl(group.getAvatarUrl()),
                myRole,
                memberCount,
                group.getCreatedAt());
    }
}