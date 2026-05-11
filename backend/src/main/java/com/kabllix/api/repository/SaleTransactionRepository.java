package com.kabllix.api.repository;

import com.kabllix.api.entity.SaleTransaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;
import java.util.List;

@Repository
public interface SaleTransactionRepository extends JpaRepository<SaleTransaction, UUID> {
    List<SaleTransaction> findByStore_IdOrderByTransactionDateDesc(UUID storeId);
}
