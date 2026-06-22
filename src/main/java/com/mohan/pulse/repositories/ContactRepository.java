package com.mohan.pulse.repositories;

import com.mohan.pulse.models.Contact;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ContactRepository extends JpaRepository<Contact, Long> {

    List<Contact> findByOwner_Id(Long ownerId);

    Optional<Contact> findByOwner_IdAndContact_Id(Long ownerId, Long contactId);

    Optional<Contact> findByIdAndOwner_Id(Long id, Long ownerId);

    @Query("SELECT c FROM Contact c WHERE c.owner.id = :ownerId AND " +
           "(LOWER(COALESCE(c.alias, '')) LIKE LOWER(CONCAT('%', :q, '%')) OR " +
           "LOWER(COALESCE(c.contact.name, '')) LIKE LOWER(CONCAT('%', :q, '%')) OR " +
           "c.contact.phone LIKE CONCAT('%', :q, '%'))")
    List<Contact> searchByOwnerIdAndQuery(@Param("ownerId") Long ownerId, @Param("q") String q);
}
