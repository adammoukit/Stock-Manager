package com.kabllix.api.controller;

import com.kabllix.api.dto.SaleRequestDTO;
import com.kabllix.api.entity.SaleTransaction;
import com.kabllix.api.service.SaleService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/sales")
@RequiredArgsConstructor
public class SaleController {

    private final SaleService saleService;

    @PostMapping
    public ResponseEntity<SaleTransaction> createSale(@RequestBody SaleRequestDTO request) {
        SaleTransaction transaction = saleService.processSale(request);
        return ResponseEntity.ok(transaction);
    }

    @GetMapping("/store/{storeId}")
    public ResponseEntity<java.util.List<com.kabllix.api.dto.SaleTransactionResponseDTO>> getStoreTransactions(@PathVariable java.util.UUID storeId) {
        return ResponseEntity.ok(saleService.getTransactionsByStore(storeId));
    }
}
