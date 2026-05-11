package com.kabllix.api.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;
import java.math.BigDecimal;

@Data
public class PackagingOptionDTO {
    
    @NotNull
    private String name;
    
    @NotNull
    @Positive
    private BigDecimal targetQty;
    
    @NotNull
    @Positive
    private BigDecimal price;
}
