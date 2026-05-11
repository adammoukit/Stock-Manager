package com.kabllix.api.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "sale_items")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SaleItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "transaction_id", nullable = false)
    @ToString.Exclude
    @com.fasterxml.jackson.annotation.JsonIgnore
    private SaleTransaction transaction;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    @com.fasterxml.jackson.annotation.JsonIgnore
    private Product product;

    @Column(nullable = false, precision = 12, scale = 4)
    private BigDecimal quantity;

    @Column(nullable = false, length = 50)
    private String saleType; // base, lot, packaging

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal unitPrice;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal totalPrice;
    
    @Column(nullable = false, precision = 12, scale = 6)
    private BigDecimal baseStockDeduction; // Amount of the primary stock unit that was deducted
}
