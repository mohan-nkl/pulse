package com.mohan.pulse.controllers;

import com.mohan.pulse.dtos.ApiResponse;
import com.mohan.pulse.dtos.AuthResponse;
import com.mohan.pulse.dtos.LoginRequest;
import com.mohan.pulse.dtos.SignupRequest;
import com.mohan.pulse.services.AuthService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/signup")
    public ApiResponse<AuthResponse> signup(@Valid @RequestBody SignupRequest request) {
        AuthResponse result = authService.signup(request);
        return ApiResponse.ok("Account created successfully", result);
    }

    @PostMapping("/login")
    public ApiResponse<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        AuthResponse result = authService.login(request);
        return ApiResponse.ok("Logged in successfully", result);
    }
}