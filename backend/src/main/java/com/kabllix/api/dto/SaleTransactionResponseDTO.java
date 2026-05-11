package com.kabllix.api.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
public class SaleTransactionResponseDTO {
    private UUID id;
    private UUID storeId;
    private BigDecimal totalAmount;
    private String paymentMethod;
    private BigDecimal amountGiven;
    private BigDecimal changeAmount;
    private String status;
    private LocalDateTime transactionDate;
    private List<SaleItemResponseDTO> items;
}
