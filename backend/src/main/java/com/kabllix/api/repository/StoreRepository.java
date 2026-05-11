package com.kabllix.api.repository;

import com.kabllix.api.entity.Store;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface StoreRepository extends JpaRepository<Store, UUID> {
    List<Store> findByOwnerId(UUID ownerId);
}
