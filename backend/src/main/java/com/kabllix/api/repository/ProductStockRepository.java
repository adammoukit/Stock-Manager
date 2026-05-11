package com.kabllix.api.repository;

import com.kabllix.api.entity.ProductStock;
import com.kabllix.api.entity.ProductStockId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;
import java.util.List;

@Repository
public interface ProductStockRepository extends JpaRepository<ProductStock, ProductStockId> {
    List<ProductStock> findByProductId(UUID productId);
    List<ProductStock> findByStoreId(UUID storeId);
    java.util.Optional<ProductStock> findByProduct_IdAndStore_Id(UUID productId, UUID storeId);
}
