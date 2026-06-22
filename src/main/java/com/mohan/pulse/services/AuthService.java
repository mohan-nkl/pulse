package com.mohan.pulse.services;

import com.mohan.pulse.dtos.AuthResponse;
import com.mohan.pulse.dtos.LoginRequest;
import com.mohan.pulse.dtos.SignupRequest;
import com.mohan.pulse.exceptions.ApiException;
import com.mohan.pulse.models.User;
import com.mohan.pulse.repositories.UserRepository;
import com.mohan.pulse.security.JwtUtil;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public AuthService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       JwtUtil jwtUtil) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
    }

    public AuthResponse signup(SignupRequest request) {

        if (userRepository.existsByPhone(request.getPhone())) {
            throw new ApiException(HttpStatus.CONFLICT, "Phone number is already registered");
        }

        User user = new User();
        user.setPhone(request.getPhone());
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setName(request.getName());

        User savedUser = userRepository.save(user);

        return buildAuthResponse(savedUser);
    }

    public AuthResponse login(LoginRequest request) {

        User user = userRepository.findByPhone(request.getPhone())
                .orElseThrow(() -> new ApiException(
                        HttpStatus.UNAUTHORIZED, "Invalid phone or password"));

        boolean passwordMatches =
                passwordEncoder.matches(request.getPassword(), user.getPasswordHash());

        if (!passwordMatches) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Invalid phone or password");
        }

        user.setLastSeen(Instant.now());
        userRepository.save(user);

        return buildAuthResponse(user);
    }

    private AuthResponse buildAuthResponse(User user) {

        String token = jwtUtil.generateToken(user.getId());

        return new AuthResponse(
                token,
                user.getId(),
                user.getPhone(),
                user.getName(),
                user.getAvatarUrl());
    }
}