package com.mohan.pulse.controllers;

import com.mohan.pulse.dtos.ApiResponse;
import com.mohan.pulse.dtos.ContactResponse;
import com.mohan.pulse.security.SecurityUtil;
import com.mohan.pulse.services.ContactService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;


@RestController
@RequestMapping("/api/contacts")
@RequiredArgsConstructor
public class ContactController {

    private final ContactService contactService;

    @GetMapping
    public ApiResponse<List<ContactResponse>> getContacts() {
        Long currentUserId = SecurityUtil.currentUserId();
        return ApiResponse.ok(contactService.getContacts(currentUserId));
    }
}