package com.kabllix.api.repository;

import com.kabllix.api.entity.ProductLot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;
import java.util.List;

@Repository
public interface ProductLotRepository extends JpaRepository<ProductLot, UUID> {
    List<ProductLot> findByProduct_IdAndStore_IdOrderByDateAddedAsc(UUID productId, UUID storeId);
}
