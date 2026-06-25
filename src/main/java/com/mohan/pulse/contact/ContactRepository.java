package com.mohan.pulse.contact;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ContactRepository extends JpaRepository<Contact, Long> {

    List<Contact> findByOwner_Id(Long ownerId);

    Optional<Contact> findByOwner_IdAndContact_Id(Long ownerId, Long contactId);

    Optional<Contact> findByIdAndOwner_Id(Long id, Long ownerId);
}