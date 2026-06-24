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
        return ResponseEntity.ok(ApiResponse.ok(contactService.listContacts(SecurityUtil.currentUserId())));
    }

    @GetMapping("/search")
    public ResponseEntity<ApiResponse<List<ContactResponse>>> searchContacts(@RequestParam String q) {
        return ResponseEntity.ok(ApiResponse.ok(contactService.searchContacts(SecurityUtil.currentUserId(), q)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<ContactResponse>> addContact(@Valid @RequestBody AddContactRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Contact added.", contactService.addContact(SecurityUtil.currentUserId(), request)));
    }

    @PostMapping("/sync")
    public ResponseEntity<ApiResponse<List<SyncedUserResponse>>> syncPhones(@Valid @RequestBody SyncRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(contactService.syncPhones(SecurityUtil.currentUserId(), request)));
    }

    @PatchMapping("/{id}/alias")
    public ResponseEntity<ApiResponse<ContactResponse>> updateAlias(
            @PathVariable Long id, @RequestBody UpdateAliasRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("Alias updated.", contactService.updateAlias(SecurityUtil.currentUserId(), id, request)));
    }

    @PostMapping("/user/{userId}")
    public ResponseEntity<ApiResponse<ContactResponse>> addContactByUserId(@PathVariable Long userId) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Contact added.", contactService.addContactByUserId(SecurityUtil.currentUserId(), userId)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> removeContact(@PathVariable Long id) {
        contactService.removeContact(SecurityUtil.currentUserId(), id);
        return ResponseEntity.ok(ApiResponse.ok("Contact removed.", null));
    }
}
