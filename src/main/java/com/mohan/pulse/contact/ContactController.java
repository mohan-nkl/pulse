package com.mohan.pulse.contact;

import com.mohan.pulse.common.ApiResponse;
import com.mohan.pulse.contact.dtos.*;
import com.mohan.pulse.common.SecurityUtil;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/contacts")
@RequiredArgsConstructor
public class ContactController {

    private final ContactService contactService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<ContactResponse>>> listContacts() {
        Long ownerId = SecurityUtil.currentUserId();
        List<ContactResponse> contacts = contactService.listContacts(ownerId);
        ApiResponse<List<ContactResponse>> body = ApiResponse.ok(contacts);
        return ResponseEntity.ok(body);
    }

    @GetMapping("/search")
    public ResponseEntity<ApiResponse<List<ContactResponse>>> searchContacts(@RequestParam String q) {
        Long ownerId = SecurityUtil.currentUserId();
        List<ContactResponse> matches = contactService.searchContacts(ownerId, q);
        ApiResponse<List<ContactResponse>> body = ApiResponse.ok(matches);
        return ResponseEntity.ok(body);
    }

    @PostMapping
    public ResponseEntity<ApiResponse<ContactResponse>> addContact(@Valid @RequestBody AddContactRequest request) {
        Long ownerId = SecurityUtil.currentUserId();
        ContactResponse added = contactService.addContact(ownerId, request);
        ApiResponse<ContactResponse> body = ApiResponse.ok("Contact added.", added);
        return ResponseEntity.status(HttpStatus.CREATED).body(body);
    }

    @PostMapping("/sync")
    public ResponseEntity<ApiResponse<List<SyncedUserResponse>>> syncPhones(@Valid @RequestBody SyncRequest request) {
        Long ownerId = SecurityUtil.currentUserId();
        List<SyncedUserResponse> matchedUsers = contactService.syncPhones(ownerId, request);
        ApiResponse<List<SyncedUserResponse>> body = ApiResponse.ok(matchedUsers);
        return ResponseEntity.ok(body);
    }

    @PatchMapping("/{id}/alias")
    public ResponseEntity<ApiResponse<ContactResponse>> updateAlias(
            @PathVariable Long id, @RequestBody UpdateAliasRequest request) {
        Long ownerId = SecurityUtil.currentUserId();
        ContactResponse updated = contactService.updateAlias(ownerId, id, request);
        ApiResponse<ContactResponse> body = ApiResponse.ok("Alias updated.", updated);
        return ResponseEntity.ok(body);
    }

    @PostMapping("/user/{userId}")
    public ResponseEntity<ApiResponse<ContactResponse>> addContactByUserId(
            @PathVariable Long userId,
            @RequestBody(required = false) UpdateAliasRequest request) {
        Long ownerId = SecurityUtil.currentUserId();

        String alias = null;
        if (request != null) {
            alias = request.getAlias();
        }

        ContactResponse added = contactService.addContactByUserId(ownerId, userId, alias);
        ApiResponse<ContactResponse> body = ApiResponse.ok("Contact added.", added);
        return ResponseEntity.status(HttpStatus.CREATED).body(body);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> removeContact(@PathVariable Long id) {
        Long ownerId = SecurityUtil.currentUserId();
        contactService.removeContact(ownerId, id);
        ApiResponse<Void> body = ApiResponse.ok("Contact removed.", null);
        return ResponseEntity.ok(body);
    }
}
