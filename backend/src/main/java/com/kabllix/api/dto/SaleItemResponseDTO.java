package com.kabllix.api.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.util.UUID;

@Data
public class SaleItemResponseDTO {
    private UUID id;
    private UUID productId;
    private String productName;
    private String productUnit;
    private BigDecimal quantity;
    private String saleType;
    private BigDecimal unitPrice;
    private BigDecimal totalPrice;
}
