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

@Service
@RequiredArgsConstructor
public class StorageService {

    private final MinioClient minioClient;

    @Value("${minio.bucket}")
    private String bucket;

    @Value("${minio.presigned-expiry-minutes}")
    private int expiryMinutes;

    public String upload(String folder, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "File must not be empty.");
        }

        String objectKey = buildObjectKey(folder, file.getOriginalFilename());
        saveToMinio(objectKey, file);
        return objectKey;
    }

    public String presignedUrl(String key) {
        if (key == null || key.isBlank()) {
            return null;
        }
        return generatePresignedUrl(key);
    }

    private String buildObjectKey(String folder, String originalFilename) {
        String uniqueName = UUID.randomUUID().toString();
        String fileExtension = extension(originalFilename);
        return folder + "/" + uniqueName + fileExtension;
    }

    private void saveToMinio(String objectKey, MultipartFile file) {
        try (InputStream fileStream = file.getInputStream()) {
            long letMinioChoosePartSize = -1;

            PutObjectArgs putRequest = PutObjectArgs.builder()
                    .bucket(bucket)
                    .object(objectKey)
                    .stream(fileStream, file.getSize(), letMinioChoosePartSize)
                    .contentType(file.getContentType())
                    .build();

            minioClient.putObject(putRequest);
        } catch (Exception e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to upload file.");
        }
    }

    private String generatePresignedUrl(String key) {
        try {
            GetPresignedObjectUrlArgs urlRequest = GetPresignedObjectUrlArgs.builder()
                    .method(Method.GET)
                    .bucket(bucket)
                    .object(key)
                    .expiry(expiryMinutes, TimeUnit.MINUTES)
                    .build();

            return minioClient.getPresignedObjectUrl(urlRequest);
        } catch (Exception e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to generate file URL.");
        }
    }

    private String extension(String filename) {
        if (filename == null || !filename.contains(".")) {
            return "";
        }
        int lastDotIndex = filename.lastIndexOf('.');
        return filename.substring(lastDotIndex);
    }
}