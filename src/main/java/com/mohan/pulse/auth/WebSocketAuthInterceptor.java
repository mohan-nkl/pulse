package com.mohan.pulse.auth;

import lombok.RequiredArgsConstructor;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Map;

@Component
@RequiredArgsConstructor
public class WebSocketAuthInterceptor implements HandshakeInterceptor {

    private static final String TOKEN_PARAM = "token=";

    private final JwtUtil jwtUtil;

    @Override
    public boolean beforeHandshake(ServerHttpRequest request,
                                   ServerHttpResponse response,
                                   WebSocketHandler wsHandler,
                                   Map<String, Object> attributes) {

        String query = request.getURI().getQuery();

        boolean tokenMissing = (query == null || !query.contains(TOKEN_PARAM));
        if (tokenMissing) {
            return false;
        }

        String token = extractToken(query);

        boolean tokenIsValid = jwtUtil.isValid(token);
        if (!tokenIsValid) {
            return false;
        }

        Long userId = jwtUtil.extractUserId(token);
        attributes.put("userId", userId);

        return true;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request,
                               ServerHttpResponse response,
                               WebSocketHandler wsHandler,
                               Exception exception) {
    }

    private String extractToken(String query) {
        String[] queryParts = query.split("&");
        for (String part : queryParts) {
            if (part.startsWith(TOKEN_PARAM)) {
                return part.substring(TOKEN_PARAM.length());
            }
        }
        return "";
    }
}