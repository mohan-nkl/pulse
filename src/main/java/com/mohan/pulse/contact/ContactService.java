package com.mohan.pulse.contact;

import com.mohan.pulse.contact.dtos.*;
import com.mohan.pulse.common.ApiException;
import com.mohan.pulse.user.User;
import com.mohan.pulse.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ContactService {

    private final ContactRepository contactRepository;
    private final UserRepository userRepository;

    public List<ContactResponse> listContacts(Long ownerId) {
        return contactRepository.findByOwner_Id(ownerId)
                .stream().map(this::toResponse).toList();
    }

    public List<ContactResponse> searchContacts(Long ownerId, String q) {
        if (q == null || q.isBlank()) return listContacts(ownerId);
        return contactRepository.searchByOwnerIdAndQuery(ownerId, q.trim())
                .stream().map(this::toResponse).toList();
    }

    public ContactResponse addContact(Long ownerId, AddContactRequest request) {
        User owner = findUser(ownerId);
        User contact = userRepository.findByPhone(request.getPhone())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "No Pulse user found with that phone number."));

        if (contact.getId().equals(ownerId))
            throw new ApiException(HttpStatus.BAD_REQUEST, "You cannot add yourself as a contact.");

        if (contactRepository.findByOwner_IdAndContact_Id(ownerId, contact.getId()).isPresent())
            throw new ApiException(HttpStatus.CONFLICT, "Contact already added.");

        Contact c = new Contact();
        c.setOwner(owner);
        c.setContact(contact);
        c.setAlias(request.getAlias() != null && !request.getAlias().isBlank()
                ? request.getAlias().trim() : null);

        return toResponse(contactRepository.save(c));
    }

    public ContactResponse updateAlias(Long ownerId, Long contactId, UpdateAliasRequest request) {
        Contact c = contactRepository.findByIdAndOwner_Id(contactId, ownerId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Contact not found."));
        String alias = request.getAlias();
        c.setAlias(alias != null && !alias.isBlank() ? alias.trim() : null);
        return toResponse(contactRepository.save(c));
    }

    public void removeContact(Long ownerId, Long contactId) {
        Contact c = contactRepository.findByIdAndOwner_Id(contactId, ownerId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Contact not found."));
        contactRepository.delete(c);
    }

    public List<SyncedUserResponse> syncPhones(Long ownerId, SyncRequest request) {
        List<User> matched = userRepository.findByPhoneIn(request.getPhones());

        Map<Long, Long> existingContacts = contactRepository.findByOwner_Id(ownerId)
                .stream().collect(Collectors.toMap(
                        c -> c.getContact().getId(),
                        Contact::getId));

        return matched.stream()
                .filter(u -> !u.getId().equals(ownerId))
                .map(u -> SyncedUserResponse.builder()
                        .userId(u.getId())
                        .name(u.getName())
                        .avatarUrl(u.getAvatarUrl())
                        .alreadyContact(existingContacts.containsKey(u.getId()))
                        .contactRecordId(existingContacts.get(u.getId()))
                        .build())
                .toList();
    }

    public ContactResponse addContactByUserId(Long ownerId, Long targetUserId) {
        User owner = findUser(ownerId);
        User contact = userRepository.findById(targetUserId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "User not found."));

        if (contact.getId().equals(ownerId))
            throw new ApiException(HttpStatus.BAD_REQUEST, "You cannot add yourself as a contact.");

        if (contactRepository.findByOwner_IdAndContact_Id(ownerId, contact.getId()).isPresent())
            throw new ApiException(HttpStatus.CONFLICT, "Contact already added.");

        Contact c = new Contact();
        c.setOwner(owner);
        c.setContact(contact);

        return toResponse(contactRepository.save(c));
    }

    private User findUser(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "User not found."));
    }

    private ContactResponse toResponse(Contact c) {
        User u = c.getContact();
        return ContactResponse.builder()
                .id(c.getId())
                .contactId(u.getId())
                .name(u.getName())
                .alias(c.getAlias())
                .avatarUrl(u.getAvatarUrl())
                .lastSeen(u.getLastSeen())
                .addedAt(c.getAddedAt())
                .build();
    }
}