package com.mohan.pulse.configs;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    @Value("${app.upload.avatar-dir}")
    private String avatarDir;

    // NEW: reads the media directory from application.properties
    @Value("${app.upload.media-dir:uploads/media}")
    private String mediaDir;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {

        // Already existed — serves profile avatars at /avatars/**
        registry.addResourceHandler("/avatars/**")
                .addResourceLocations("file:" + avatarDir + "/");

        // NEW — serves chat media files at /media/**
        // So http://localhost:8080/media/abc.jpg loads the file from uploads/media/abc.jpg
        registry.addResourceHandler("/media/**")
                .addResourceLocations("file:" + mediaDir + "/");
    }
}