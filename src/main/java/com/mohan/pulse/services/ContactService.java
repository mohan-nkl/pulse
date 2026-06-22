package com.mohan.pulse.services;

import com.mohan.pulse.dtos.ContactResponse;
import com.mohan.pulse.models.Contact;
import com.mohan.pulse.repositories.ContactRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;


@Service
@RequiredArgsConstructor
public class ContactService {

    private final ContactRepository contactRepository;

    public List<ContactResponse> getContacts(Long ownerId) {
        return contactRepository.findByOwnerId(ownerId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private ContactResponse toResponse(Contact contact) {
        return new ContactResponse(
                contact.getContact().getId(),
                contact.getContact().getName(),
                contact.getContact().getAvatarUrl());
    }
}