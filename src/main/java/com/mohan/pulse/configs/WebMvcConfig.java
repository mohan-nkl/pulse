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

    @Value("${app.upload.media-dir:uploads/media}")
    private String mediaDir;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {

        // avatars
        registry.addResourceHandler("/avatars/**")
                .addResourceLocations("file:" + avatarDir + "/");

        // chat media
        registry.addResourceHandler("/media/**")
                .addResourceLocations("file:" + mediaDir + "/");

        // status media
        registry.addResourceHandler("/status-media/**")
                .addResourceLocations("file:" + statusDir + "/");
    }
}