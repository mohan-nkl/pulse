package com.mohan.pulse.storage;

import com.mohan.pulse.common.ApiException;
import io.minio.GetPresignedObjectUrlArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.http.Method;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * Wraps MinIO object storage. Uploads return an OBJECT KEY (e.g. "avatars/ab12.jpg"),
 * not a URL — we store the key and mint a fresh presigned URL on read, because
 * presigned URLs expire.
 */
@Service
@RequiredArgsConstructor
public class StorageService {

    private final MinioClient minioClient;

    @Value("${minio.bucket}")
    private String bucket;

    @Value("${minio.presigned-expiry-minutes}")
    private int expiryMinutes;

    /**
     * Upload a file under the given folder ("avatars", "media", "status").
     * Returns the object key to store in the DB.
     */
    public String upload(String folder, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "File must not be empty.");
        }

        String key = folder + "/" + UUID.randomUUID() + extension(file.getOriginalFilename());

        try (InputStream in = file.getInputStream()) {
            minioClient.putObject(
                    PutObjectArgs.builder()
                            .bucket(bucket)
                            .object(key)
                            .stream(in, file.getSize(), -1)
                            .contentType(file.getContentType())
                            .build());
        } catch (Exception e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to upload file.");
        }

        return key;
    }

    /**
     * Generate a time-limited presigned URL for an object key.
     * Returns null for null/blank keys so callers can pass through cleanly.
     */
    public String presignedUrl(String key) {
        if (key == null || key.isBlank()) {
            return null;
        }
        try {
            return minioClient.getPresignedObjectUrl(
                    GetPresignedObjectUrlArgs.builder()
                            .method(Method.GET)
                            .bucket(bucket)
                            .object(key)
                            .expiry(expiryMinutes, TimeUnit.MINUTES)
                            .build());
        } catch (Exception e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to generate file URL.");
        }
    }

    private String extension(String filename) {
        if (filename == null || !filename.contains(".")) return "";
        return filename.substring(filename.lastIndexOf('.'));
    }
}