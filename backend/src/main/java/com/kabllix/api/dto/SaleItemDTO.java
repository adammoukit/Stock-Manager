package com.kabllix.api.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
public class SaleItemDTO {
    private UUID productId;
    private BigDecimal quantity;
    private String type; // 'base', 'lot', 'packaging'
    private BigDecimal unitPrice;
    
    // Optional: Used if type is 'packaging' to identify the specific fraction rule
    // Though the backend can also recalculate based on the product's packaging list.
    // We will trust the backend's deduction calculation rather than the frontend's stockDeduction.
    private String packagingName; 
}
