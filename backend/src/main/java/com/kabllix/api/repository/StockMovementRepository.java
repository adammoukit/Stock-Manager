package com.kabllix.api.repository;

import com.kabllix.api.entity.StockMovement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;
import java.util.List;

@Repository
public interface StockMovementRepository extends JpaRepository<StockMovement, UUID> {
    List<StockMovement> findByProductIdAndStoreIdOrderByDateDesc(UUID productId, Integer storeId);
}
