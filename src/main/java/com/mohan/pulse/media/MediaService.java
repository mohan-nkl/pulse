package com.mohan.pulse.media;

import com.mohan.pulse.exceptions.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;

/**
 * Saves an uploaded file to disk and returns its public URL.
 * Follows the exact same pattern as UserProfileService.uploadAvatar().
 */
@Service
public class MediaService {

    @Value("${app.upload.media-dir}")
    private String mediaDir;

    @Value("${app.upload.base-url}")
    private String baseUrl;

    // 20 MB limit
    private static final long MAX_SIZE = 20L * 1024 * 1024;

    public String upload(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "File must not be empty.");
        }
        if (file.getSize() > MAX_SIZE) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "File must not exceed 20 MB.");
        }

        // Random name so two files with the same name don't overwrite each other
        String filename = UUID.randomUUID() + getExtension(file.getOriginalFilename());
        Path dir = Paths.get(mediaDir);

        try {
            Files.createDirectories(dir);                          // creates uploads/media/ if it doesn't exist
            Files.write(dir.resolve(filename), file.getBytes());   // saves the file
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to save file.");
        }

        // Return the URL the frontend will use to display the file
        return baseUrl + "/media/" + filename;
    }

    private String getExtension(String filename) {
        if (filename == null || !filename.contains(".")) return "";
        return filename.substring(filename.lastIndexOf('.'));
    }
}