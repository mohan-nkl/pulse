package com.mohan.pulse.auth;

import org.springframework.http.server.ServerHttpRequest;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.support.DefaultHandshakeHandler;

import java.security.Principal;
import java.util.Map;

public class WebSocketHandshakeHandler extends DefaultHandshakeHandler {

    @Override
    protected Principal determineUser(ServerHttpRequest request,
                                      WebSocketHandler wsHandler,
                                      Map<String, Object> attributes) {

        Long userId = (Long) attributes.get("userId");

        if (userId == null) {
            return null;
        }

        String userIdAsName = userId.toString();

        return new Principal() {
            @Override
            public String getName() {
                return userIdAsName;
            }
        };
    }
}