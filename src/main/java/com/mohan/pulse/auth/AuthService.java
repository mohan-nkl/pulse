package com.mohan.pulse.auth;

import com.mohan.pulse.auth.dtos.AuthResponse;
import com.mohan.pulse.auth.dtos.LoginRequest;
import com.mohan.pulse.auth.dtos.SignupRequest;
import com.mohan.pulse.common.ApiException;
import com.mohan.pulse.storage.StorageService;
import com.mohan.pulse.user.User;
import com.mohan.pulse.user.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Optional;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final StorageService storageService;

    public AuthService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       JwtUtil jwtUtil,
                       StorageService storageService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
        this.storageService = storageService;
    }

    public AuthResponse signup(SignupRequest request) {
        boolean phoneAlreadyRegistered = userRepository.existsByPhone(request.getPhone());
        if (phoneAlreadyRegistered) {
            throw new ApiException(HttpStatus.CONFLICT, "Phone number is already registered");
        }

        String hashedPassword = passwordEncoder.encode(request.getPassword());

        User user = new User();
        user.setPhone(request.getPhone());
        user.setPasswordHash(hashedPassword);
        user.setName(request.getName());

        User savedUser = userRepository.save(user);
        return buildAuthResponse(savedUser);
    }

    public AuthResponse login(LoginRequest request) {
        User user = findUserByPhoneOrThrow(request.getPhone());

        boolean passwordMatches =
                passwordEncoder.matches(request.getPassword(), user.getPasswordHash());
        if (!passwordMatches) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Invalid phone or password");
        }

        user.setLastSeen(Instant.now());
        userRepository.save(user);

        return buildAuthResponse(user);
    }

    private User findUserByPhoneOrThrow(String phone) {
        Optional<User> maybeUser = userRepository.findByPhone(phone);
        if (maybeUser.isEmpty()) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Invalid phone or password");
        }
        return maybeUser.get();
    }

    private AuthResponse buildAuthResponse(User user) {
        String token = jwtUtil.generateToken(user.getId());
        String avatarUrl = storageService.presignedUrl(user.getAvatarUrl());

        return new AuthResponse(
                token,
                user.getId(),
                user.getPhone(),
                user.getName(),
                avatarUrl);
    }
}