package com.kabllix.api.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Data
public class SaleRequestDTO {
    private UUID storeId;
    private String paymentMethod;
    private BigDecimal amountGiven;
    private BigDecimal changeAmount;
    private List<SaleItemDTO> items;
}
