package com.kabllix.api.repository;

import com.kabllix.api.entity.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ProductRepository extends JpaRepository<Product, UUID> {
    List<Product> findByOwnerId(UUID ownerId);
    List<Product> findByOwnerIdOrderByCreatedAtAsc(UUID ownerId);
    Optional<Product> findByBarcodeAndOwnerId(String barcode, UUID ownerId);
    boolean existsByBarcodeAndOwnerId(String barcode, UUID ownerId);
}
