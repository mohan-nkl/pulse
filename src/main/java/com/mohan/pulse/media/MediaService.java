package com.mohan.pulse.media;

import com.mohan.pulse.common.ApiException;
import com.mohan.pulse.storage.StorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class MediaService {

    private static final long MAX_SIZE = 20L * 1024 * 1024;

    private final StorageService storageService;

    public String upload(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "File must not be empty.");
        }
        if (file.getSize() > MAX_SIZE) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "File must not exceed 20 MB.");
        }
        return storageService.upload("media", file);
    }
}
