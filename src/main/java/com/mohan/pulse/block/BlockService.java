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

import java.util.List;

@Service
@RequiredArgsConstructor
public class BlockService {

    private final BlockRepository blockRepository;
    private final UserRepository userRepository;
    private final StorageService storageService;

    @Transactional
    public void block(Long blockerId, Long blockedId) {
        if (blockerId.equals(blockedId)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "You cannot block yourself.");
        }
        // Idempotent: if already blocked, do nothing.
        if (blockRepository.existsByBlocker_IdAndBlocked_Id(blockerId, blockedId)) {
            return;
        }
        User blocker = userRepository.findById(blockerId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "User not found."));
        User blocked = userRepository.findById(blockedId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "User to block not found."));

        Block block = new Block();
        block.setBlocker(blocker);
        block.setBlocked(blocked);
        blockRepository.save(block);
    }

    @Transactional
    public void unblock(Long blockerId, Long blockedId) {
        blockRepository.findByBlocker_IdAndBlocked_Id(blockerId, blockedId)
                .ifPresent(blockRepository::delete);
    }

    @Transactional(readOnly = true)
    public boolean hasBlocked(Long blockerId, Long blockedId) {
        return blockRepository.existsByBlocker_IdAndBlocked_Id(blockerId, blockedId);
    }

    /**
     * True if either user has blocked the other. A DM must not be delivered when
     * this is true.
     */
    @Transactional(readOnly = true)
    public boolean isBlockedBetween(Long a, Long b) {
        return blockRepository.existsBlockBetween(a, b);
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
        return blockRepository.findByBlocker_Id(blockerId).stream()
                .map(b -> {
                    User u = b.getBlocked();
                    return new BlockedUserResponse(
                            u.getId(),
                            u.getName(),
                            storageService.presignedUrl(u.getAvatarUrl()),
                            b.getCreatedAt());
                })
                .toList();
    }
}