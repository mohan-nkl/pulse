package com.mohan.pulse.group;

import com.mohan.pulse.group.dtos.AddMembersRequest;
import com.mohan.pulse.group.dtos.CreateGroupRequest;
import com.mohan.pulse.group.dtos.GroupMemberResponse;
import com.mohan.pulse.group.dtos.GroupResponse;
import com.mohan.pulse.group.dtos.UpdateGroupRequest;
import com.mohan.pulse.common.ApiException;
import com.mohan.pulse.storage.StorageService;
import com.mohan.pulse.user.User;
import com.mohan.pulse.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class GroupService {

    private final GroupRepository groupRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final UserRepository userRepository;
    private final StorageService storageService;
    private final SimpMessagingTemplate messagingTemplate;

    private static final String GROUP_ADDED_QUEUE = "/queue/group-added";

    private static final List<String> ALLOWED_AVATAR_TYPES = List.of("image/jpeg", "image/png", "image/webp");
    private static final long MAX_AVATAR_SIZE = 5L * 1024 * 1024;

    @Transactional
    public GroupResponse createGroup(Long creatorId, CreateGroupRequest request) {
        User creator = findUserOrThrow(creatorId);

        Group group = new Group();
        group.setName(request.getName());
        group.setCreatedBy(creator);
        Group savedGroup = groupRepository.save(group);

        addMembership(savedGroup, creator, GroupRole.ADMIN);
        addInitialMembers(savedGroup, creatorId, request.getMemberIds());

        int memberCount = countMembers(savedGroup.getId());
        return toGroupResponse(savedGroup, GroupRole.ADMIN, memberCount);
    }

    @Transactional(readOnly = true)
    public List<GroupResponse> listMyGroups(Long userId) {
        List<GroupMember> memberships = groupMemberRepository.findByUserId(userId);

        List<GroupResponse> responses = new ArrayList<>();
        for (GroupMember membership : memberships) {
            Group group = membership.getGroup();
            int memberCount = countMembers(group.getId());
            responses.add(toGroupResponse(group, membership.getRole(), memberCount));
        }
        return responses;
    }

    @Transactional(readOnly = true)
    public List<GroupMemberResponse> getMembers(Long actorId, Long groupId) {
        requireMembership(groupId, actorId);

        List<GroupMember> members = groupMemberRepository.findByGroupId(groupId);

        List<GroupMemberResponse> responses = new ArrayList<>();
        for (GroupMember member : members) {
            responses.add(toMemberResponse(member));
        }
        return responses;
    }

    @Transactional
    public List<GroupMemberResponse> addMembers(Long actorId, Long groupId, AddMembersRequest request) {
        requireAdmin(actorId, groupId);
        Group group = findGroupOrThrow(groupId);

        for (Long memberId : request.getMemberIds()) {
            boolean alreadyMember = groupMemberRepository.existsByGroupIdAndUserId(groupId, memberId);
            if (!alreadyMember) {
                User member = findUserOrThrow(memberId);
                addMembership(group, member, GroupRole.MEMBER);
                notifyAddedToGroup(group, member.getId());
            }
        }

        return getMembers(actorId, groupId);
    }

    @Transactional
    public List<GroupMemberResponse> removeMember(Long actorId, Long groupId, Long targetUserId) {
        requireAdmin(actorId, groupId);

        boolean removingYourself = targetUserId.equals(actorId);
        if (removingYourself) {
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

        List<GroupMember> remainingMembers = groupMemberRepository.findByGroupId(groupId);

        boolean groupIsNowEmpty = remainingMembers.isEmpty();
        if (groupIsNowEmpty) {
            groupRepository.deleteById(groupId);
            return;
        }

        boolean hasAdmin = anyAdmin(remainingMembers);
        if (!hasAdmin) {
            promoteEarliestMemberToAdmin(remainingMembers);
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

    @Transactional
    public List<GroupMemberResponse> demoteAdmin(Long actorId, Long groupId, Long targetUserId) {
        requireAdmin(actorId, groupId);

        boolean demotingYourself = targetUserId.equals(actorId);
        if (demotingYourself) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "You cannot dismiss yourself as admin.");
        }

        GroupMember target = requireMembership(groupId, targetUserId);
        target.setRole(GroupRole.MEMBER);
        groupMemberRepository.save(target);

        return getMembers(actorId, groupId);
    }

    @Transactional
    public GroupResponse updateGroup(Long actorId, Long groupId, UpdateGroupRequest request) {
        requireAdmin(actorId, groupId);

        Group group = findGroupOrThrow(groupId);
        group.setName(request.getName().trim());
        Group savedGroup = groupRepository.save(group);

        int memberCount = countMembers(groupId);
        return toGroupResponse(savedGroup, GroupRole.ADMIN, memberCount);
    }

    @Transactional
    public GroupResponse updateGroupAvatar(Long actorId, Long groupId, MultipartFile file) {
        requireAdmin(actorId, groupId);
        validateAvatar(file);

        Group group = findGroupOrThrow(groupId);
        String avatarKey = storageService.upload("groups", file);
        group.setAvatarUrl(avatarKey);
        Group savedGroup = groupRepository.save(group);

        int memberCount = countMembers(groupId);
        return toGroupResponse(savedGroup, GroupRole.ADMIN, memberCount);
    }

    private void validateAvatar(MultipartFile file) {
        boolean fileMissing = (file == null || file.isEmpty());
        if (fileMissing) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "File must not be empty.");
        }

        boolean tooLarge = file.getSize() > MAX_AVATAR_SIZE;
        if (tooLarge) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Group photo must not exceed 5 MB.");
        }

        boolean unsupportedType = !ALLOWED_AVATAR_TYPES.contains(file.getContentType());
        if (unsupportedType) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Group photo must be JPEG, PNG, or WebP.");
        }
    }

    private void addInitialMembers(Group group, Long creatorId, List<Long> memberIds) {
        if (memberIds == null) {
            return;
        }

        for (Long memberId : memberIds) {
            boolean isCreator = memberId.equals(creatorId);
            boolean alreadyMember = groupMemberRepository.existsByGroupIdAndUserId(group.getId(), memberId);

            if (!isCreator && !alreadyMember) {
                User member = findUserOrThrow(memberId);
                addMembership(group, member, GroupRole.MEMBER);
                notifyAddedToGroup(group, member.getId());
            }
        }
    }

    private boolean anyAdmin(List<GroupMember> members) {
        for (GroupMember member : members) {
            if (member.getRole() == GroupRole.ADMIN) {
                return true;
            }
        }
        return false;
    }

    private void promoteEarliestMemberToAdmin(List<GroupMember> members) {
        GroupMember earliestMember = members.get(0);
        for (GroupMember member : members) {
            boolean joinedEarlier = member.getJoinedAt().isBefore(earliestMember.getJoinedAt());
            if (joinedEarlier) {
                earliestMember = member;
            }
        }

        earliestMember.setRole(GroupRole.ADMIN);
        groupMemberRepository.save(earliestMember);
    }

    private int countMembers(Long groupId) {
        return groupMemberRepository.findByGroupId(groupId).size();
    }

    private Group findGroupOrThrow(Long groupId) {
        Optional<Group> maybeGroup = groupRepository.findById(groupId);
        if (maybeGroup.isEmpty()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Group not found");
        }
        return maybeGroup.get();
    }

    private User findUserOrThrow(Long userId) {
        Optional<User> maybeUser = userRepository.findById(userId);
        if (maybeUser.isEmpty()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "User not found");
        }
        return maybeUser.get();
    }

    private GroupMember requireMembership(Long groupId, Long userId) {
        Optional<GroupMember> maybeMember = groupMemberRepository.findByGroupIdAndUserId(groupId, userId);
        if (maybeMember.isEmpty()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "You are not a member of this group.");
        }
        return maybeMember.get();
    }

    private void requireAdmin(Long actorId, Long groupId) {
        GroupMember membership = requireMembership(groupId, actorId);

        boolean isAdmin = (membership.getRole() == GroupRole.ADMIN);
        if (!isAdmin) {
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

    private void notifyAddedToGroup(Group group, Long userId) {
        int memberCount = countMembers(group.getId());
        GroupResponse response = toGroupResponse(group, GroupRole.MEMBER, memberCount);
        messagingTemplate.convertAndSendToUser(userId.toString(), GROUP_ADDED_QUEUE, response);
    }

    private GroupMemberResponse toMemberResponse(GroupMember member) {
        User user = member.getUser();
        String avatarUrl = storageService.presignedUrl(user.getAvatarUrl());

        return new GroupMemberResponse(
                user.getId(),
                user.getName(),
                avatarUrl,
                member.getRole());
    }

    private GroupResponse toGroupResponse(Group group, GroupRole myRole, int memberCount) {
        String avatarUrl = storageService.presignedUrl(group.getAvatarUrl());

        return new GroupResponse(
                group.getId(),
                group.getName(),
                avatarUrl,
                myRole,
                memberCount,
                group.getCreatedAt());
    }
}