package com.kabllix.api.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;

@Entity
@Table(name = "product_stocks")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@IdClass(ProductStockId.class)
public class ProductStock {

    @Id
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id")
    @ToString.Exclude
    private Product product;

    @Id
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id")
    private Store store;

    @Column(nullable = false, precision = 12, scale = 4)
    private BigDecimal quantity;

    @Column(name = "min_quantity", nullable = false, precision = 10, scale = 2)
    private BigDecimal minQuantity;
}
