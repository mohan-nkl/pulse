package com.mohan.pulse.config;

import com.mohan.pulse.auth.WebSocketAuthInterceptor;
import com.mohan.pulse.auth.WebSocketHandshakeHandler;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

import java.util.ArrayList;
import java.util.List;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private static final String WEBSOCKET_ENDPOINT = "/ws";

    @Value("${app.allowed-origins}")
    private String allowedOrigins;

    private final WebSocketAuthInterceptor authInterceptor;

    public WebSocketConfig(WebSocketAuthInterceptor authInterceptor) {
        this.authInterceptor = authInterceptor;
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        String[] originValues = allowedOrigins.split(",");

        List<String> origins = new ArrayList<>();
        for (String value : originValues) {
            String origin = value.trim();
            if (!origin.isEmpty()) {
                origins.add(origin);
            }
        }
        String[] allowedOriginsArray = origins.toArray(new String[0]);

        registry
                .addEndpoint(WEBSOCKET_ENDPOINT)
                .addInterceptors(authInterceptor)
                .setHandshakeHandler(new WebSocketHandshakeHandler())
                .setAllowedOrigins(allowedOriginsArray)
                .withSockJS();
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {

        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(1);
        scheduler.setThreadNamePrefix("ws-heartbeat-");
        scheduler.initialize();

        registry.enableSimpleBroker("/topic", "/queue")
                .setHeartbeatValue(new long[] { 10000, 10000 })
                .setTaskScheduler(scheduler);

        registry.setApplicationDestinationPrefixes("/app");

        registry.setUserDestinationPrefix("/user");
    }
}
