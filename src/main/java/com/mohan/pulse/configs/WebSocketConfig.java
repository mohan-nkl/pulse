package com.mohan.pulse.configs;

import com.mohan.pulse.security.WebSocketAuthInterceptor;
import com.mohan.pulse.security.WebSocketHandshakeHandler;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private static final String WEBSOCKET_ENDPOINT = "/ws";

    private static final String[] ALLOWED_ORIGINS = {
            "http://localhost:5173"
    };

    private final WebSocketAuthInterceptor authInterceptor;

    public WebSocketConfig(WebSocketAuthInterceptor authInterceptor) {
        this.authInterceptor = authInterceptor;
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry
                .addEndpoint(WEBSOCKET_ENDPOINT)
                .addInterceptors(authInterceptor)
                .setHandshakeHandler(new WebSocketHandshakeHandler())
                .setAllowedOrigins(ALLOWED_ORIGINS)
                .withSockJS();
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {

        registry.enableSimpleBroker("/topic", "/queue");

        registry.setApplicationDestinationPrefixes("/app");

        registry.setUserDestinationPrefix("/user");
    }
}