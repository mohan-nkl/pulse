package com.mohan.pulse.block;

import com.mohan.pulse.block.dtos.BlockedUserResponse;
import com.mohan.pulse.common.ApiException;
import com.mohan.pulse.storage.StorageService;
import com.mohan.pulse.user.User;
import com.mohan.pulse.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class BlockService {

    private final BlockRepository blockRepository;
    private final UserRepository userRepository;
    private final StorageService storageService;

    @Transactional
    public void block(Long blockerId, Long blockedId) {
        boolean blockingYourself = blockerId.equals(blockedId);
        if (blockingYourself) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "You cannot block yourself.");
        }

        boolean alreadyBlocked = blockRepository.existsByBlocker_IdAndBlocked_Id(blockerId, blockedId);
        if (alreadyBlocked) {
            return;
        }

        User blocker = findUserOrThrow(blockerId, "User not found.");
        User blocked = findUserOrThrow(blockedId, "User to block not found.");

        Block block = new Block();
        block.setBlocker(blocker);
        block.setBlocked(blocked);

        blockRepository.save(block);
    }

    @Transactional
    public void unblock(Long blockerId, Long blockedId) {
        Optional<Block> existingBlock =
                blockRepository.findByBlocker_IdAndBlocked_Id(blockerId, blockedId);

        if (existingBlock.isPresent()) {
            blockRepository.delete(existingBlock.get());
        }
    }

    @Transactional(readOnly = true)
    public boolean hasBlocked(Long blockerId, Long blockedId) {
        return blockRepository.existsByBlocker_IdAndBlocked_Id(blockerId, blockedId);
    }

    @Transactional(readOnly = true)
    public boolean isBlockedBetween(Long firstUserId, Long secondUserId) {
        return blockRepository.existsBlockBetween(firstUserId, secondUserId);
    }

    @Transactional(readOnly = true)
    public List<Long> blockedIdsOf(Long blockerId) {
        return blockRepository.findBlockedIdsByBlocker(blockerId);
    }

    @Transactional(readOnly = true)
    public List<Long> blockersOf(Long blockedId) {
        return blockRepository.findBlockerIdsByBlocked(blockedId);
    }

    @Transactional(readOnly = true)
    public List<BlockedUserResponse> listBlocked(Long blockerId) {
        List<Block> blocks = blockRepository.findByBlocker_Id(blockerId);

        List<BlockedUserResponse> blockedUsers = new ArrayList<>();
        for (Block block : blocks) {
            BlockedUserResponse response = toBlockedUserResponse(block);
            blockedUsers.add(response);
        }
        return blockedUsers;
    }

    private BlockedUserResponse toBlockedUserResponse(Block block) {
        User blockedUser = block.getBlocked();
        String avatarUrl = storageService.presignedUrl(blockedUser.getAvatarUrl());

        return new BlockedUserResponse(
                blockedUser.getId(),
                blockedUser.getName(),
                blockedUser.getPhone(),
                avatarUrl,
                block.getCreatedAt());
    }

    private User findUserOrThrow(Long userId, String notFoundMessage) {
        Optional<User> maybeUser = userRepository.findById(userId);
        if (maybeUser.isEmpty()) {
            throw new ApiException(HttpStatus.NOT_FOUND, notFoundMessage);
        }
        return maybeUser.get();
    }
}