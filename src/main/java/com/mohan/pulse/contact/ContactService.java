package com.mohan.pulse.contact;

import com.mohan.pulse.block.BlockService;
import com.mohan.pulse.common.ApiException;
import com.mohan.pulse.contact.dtos.AddContactRequest;
import com.mohan.pulse.contact.dtos.ContactResponse;
import com.mohan.pulse.contact.dtos.SyncRequest;
import com.mohan.pulse.contact.dtos.SyncedUserResponse;
import com.mohan.pulse.contact.dtos.UpdateAliasRequest;
import com.mohan.pulse.storage.StorageService;
import com.mohan.pulse.user.User;
import com.mohan.pulse.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ContactService {

    private final ContactRepository contactRepository;
    private final UserRepository userRepository;
    private final StorageService storageService;
    private final BlockService blockService;

    public List<ContactResponse> listContacts(Long ownerId) {
        List<Contact> contacts = contactRepository.findByOwner_Id(ownerId);

        List<ContactResponse> responses = new ArrayList<>();
        for (Contact contact : contacts) {
            responses.add(toResponse(contact));
        }
        return responses;
    }

    public List<ContactResponse> searchContacts(Long ownerId, String q) {
        boolean noSearchText = (q == null || q.isBlank());
        if (noSearchText) {
            return listContacts(ownerId);
        }

        String trimmedQuery = q.trim();
        List<Contact> ownedContacts = contactRepository.findByOwner_Id(ownerId);

        List<ContactResponse> responses = new ArrayList<>();
        for (Contact contact : ownedContacts) {
            if (matchesQuery(contact, trimmedQuery)) {
                responses.add(toResponse(contact));
            }
        }
        return responses;
    }

    private boolean matchesQuery(Contact contact, String query) {
        String lowerCaseQuery = query.toLowerCase();

        String alias = contact.getAlias();
        boolean aliasMatches = alias != null && alias.toLowerCase().contains(lowerCaseQuery);

        String contactName = contact.getContact().getName();
        boolean nameMatches = contactName != null && contactName.toLowerCase().contains(lowerCaseQuery);

        String phone = contact.getContact().getPhone();
        boolean phoneMatches = phone != null && phone.contains(query);

        return aliasMatches || nameMatches || phoneMatches;
    }

    public ContactResponse addContact(Long ownerId, AddContactRequest request) {
        User owner = findUserOrThrow(ownerId, "User not found.");
        User contactUser = findUserByPhoneOrThrow(request.getPhone());

        ensureNotSelf(ownerId, contactUser.getId());
        ensureNotAlreadyContact(ownerId, contactUser.getId());

        Contact contact = new Contact();
        contact.setOwner(owner);
        contact.setContact(contactUser);
        contact.setAlias(cleanAlias(request.getAlias()));

        Contact savedContact = contactRepository.save(contact);
        return toResponse(savedContact);
    }

    public ContactResponse addContactByUserId(Long ownerId, Long targetUserId) {
        User owner = findUserOrThrow(ownerId, "User not found.");
        User contactUser = findUserOrThrow(targetUserId, "User not found.");

        ensureNotSelf(ownerId, contactUser.getId());
        ensureNotAlreadyContact(ownerId, contactUser.getId());

        Contact contact = new Contact();
        contact.setOwner(owner);
        contact.setContact(contactUser);

        Contact savedContact = contactRepository.save(contact);
        return toResponse(savedContact);
    }

    public ContactResponse updateAlias(Long ownerId, Long contactId, UpdateAliasRequest request) {
        Contact contact = findOwnedContactOrThrow(contactId, ownerId);
        contact.setAlias(cleanAlias(request.getAlias()));

        Contact savedContact = contactRepository.save(contact);
        return toResponse(savedContact);
    }

    public void removeContact(Long ownerId, Long contactId) {
        Contact contact = findOwnedContactOrThrow(contactId, ownerId);
        contactRepository.delete(contact);
    }

    public List<SyncedUserResponse> syncPhones(Long ownerId, SyncRequest request) {
        List<User> matchedUsers = userRepository.findByPhoneIn(request.getPhones());
        Map<Long, Long> contactRecordIdByUserId = buildExistingContactMap(ownerId);

        List<SyncedUserResponse> results = new ArrayList<>();
        for (User user : matchedUsers) {
            boolean isOwner = user.getId().equals(ownerId);
            if (isOwner) {
                continue;
            }

            boolean alreadyContact = contactRecordIdByUserId.containsKey(user.getId());
            Long contactRecordId = contactRecordIdByUserId.get(user.getId());
            String avatarUrl = storageService.presignedUrl(user.getAvatarUrl());

            SyncedUserResponse response = SyncedUserResponse.builder()
                    .userId(user.getId())
                    .name(user.getName())
                    .avatarUrl(avatarUrl)
                    .alreadyContact(alreadyContact)
                    .contactRecordId(contactRecordId)
                    .build();
            results.add(response);
        }
        return results;
    }

    private Map<Long, Long> buildExistingContactMap(Long ownerId) {
        List<Contact> existingContacts = contactRepository.findByOwner_Id(ownerId);

        Map<Long, Long> contactRecordIdByUserId = new HashMap<>();
        for (Contact contact : existingContacts) {
            Long contactUserId = contact.getContact().getId();
            Long contactRecordId = contact.getId();
            contactRecordIdByUserId.put(contactUserId, contactRecordId);
        }
        return contactRecordIdByUserId;
    }

    private ContactResponse toResponse(Contact contact) {
        User contactUser = contact.getContact();
        Long ownerId = contact.getOwner().getId();

        boolean hiddenByBlock = blockService.isBlockedBetween(contactUser.getId(), ownerId);

        String avatarUrl = null;
        Instant lastSeen = null;
        if (!hiddenByBlock) {
            avatarUrl = storageService.presignedUrl(contactUser.getAvatarUrl());
            lastSeen = contactUser.getLastSeen();
        }

        return ContactResponse.builder()
                .id(contact.getId())
                .contactId(contactUser.getId())
                .name(contactUser.getName())
                .alias(contact.getAlias())
                .avatarUrl(avatarUrl)
                .lastSeen(lastSeen)
                .addedAt(contact.getAddedAt())
                .build();
    }

    private User findUserOrThrow(Long userId, String notFoundMessage) {
        Optional<User> maybeUser = userRepository.findById(userId);
        if (maybeUser.isEmpty()) {
            throw new ApiException(HttpStatus.NOT_FOUND, notFoundMessage);
        }
        return maybeUser.get();
    }

    private User findUserByPhoneOrThrow(String phone) {
        Optional<User> maybeUser = userRepository.findByPhone(phone);
        if (maybeUser.isEmpty()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "No Pulse user found with that phone number.");
        }
        return maybeUser.get();
    }

    private Contact findOwnedContactOrThrow(Long contactId, Long ownerId) {
        Optional<Contact> maybeContact = contactRepository.findByIdAndOwner_Id(contactId, ownerId);
        if (maybeContact.isEmpty()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Contact not found.");
        }
        return maybeContact.get();
    }

    private void ensureNotSelf(Long ownerId, Long contactUserId) {
        boolean addingYourself = contactUserId.equals(ownerId);
        if (addingYourself) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "You cannot add yourself as a contact.");
        }
    }

    private void ensureNotAlreadyContact(Long ownerId, Long contactUserId) {
        boolean alreadyContact =
                contactRepository.findByOwner_IdAndContact_Id(ownerId, contactUserId).isPresent();
        if (alreadyContact) {
            throw new ApiException(HttpStatus.CONFLICT, "Contact already added.");
        }
    }

    private String cleanAlias(String alias) {
        boolean aliasProvided = (alias != null && !alias.isBlank());
        if (aliasProvided) {
            return alias.trim();
        }
        return null;
    }
}