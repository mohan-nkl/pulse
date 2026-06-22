package com.mohan.pulse.repositories;

import com.mohan.pulse.models.Contact;
import org.hibernate.dialect.lock.OptimisticEntityLockException;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ContactsRepository extends JpaRepository<Contact, Long> {

    List<Contact> findByOwner(Long ownerId);

    Optional<Contact> findByOwner_idAndContact_Id(Long ownerId, Long contactId);

    Optional<Contact> findByIdAndOwnerId(Long id, Long ownerId);

    @Query("SELECT c FROM Contact c WHERE c.owner.id = :ownerId AND " +
            "(LOWER(COALESCE(c.alias, '')) LIKE LOWER(CONCAT('%', :q, '%')) OR " +
            "LOWER(COALESCE(c.contact.name, '')) LIKE LOWER(CONCAT('%', :q, '%')) OR " +
            "c.contact.phone LIKE CONCAT('%', :q, '%'))")
    List<Contact> searchByOwnerIdAndQuery(@Param("ownerId") Long ownerId, @Param("q") String q);


}
