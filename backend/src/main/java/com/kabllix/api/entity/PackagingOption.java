package com.kabllix.api.entity;

import jakarta.persistence.*;
import java.util.UUID;
import lombok.*;
import java.math.BigDecimal;

@Entity
@Table(name = "packaging_options")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PackagingOption {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    @ToString.Exclude
    private Product product;

    @Column(nullable = false, length = 100)
    private String name; // ex: "5 Kilos"

    @Column(nullable = false, precision = 10, scale = 4)
    private BigDecimal targetQty; // ex: 5.0

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal price; // ex: 750.00

    // Ratio déduit du stock global (targetQty / conversionFactor de l'entité Product)
    @Column(nullable = false, precision = 10, scale = 6)
    private BigDecimal deductionRatio; // ex: 0.100000
}
