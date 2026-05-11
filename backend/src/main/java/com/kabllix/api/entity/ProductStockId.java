package com.kabllix.api.entity;

import lombok.Data;
import java.io.Serializable;
import java.util.UUID;

@Data
public class ProductStockId implements Serializable {
    private UUID product;
    private UUID store;
}
