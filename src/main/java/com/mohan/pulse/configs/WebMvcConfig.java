package com.mohan.pulse.configs;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    @Value("${app.upload.avatar-dir}")
    private String avatarDir;

    @Value("${app.upload.status-dir}")
    private String statusDir;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // Serve avatar images at /avatars/**
        registry.addResourceHandler("/avatars/**")
                .addResourceLocations("file:" + avatarDir + "/");

        // Serve status media images at /status-media/**
        registry.addResourceHandler("/status-media/**")
                .addResourceLocations("file:" + statusDir + "/");
    }
}