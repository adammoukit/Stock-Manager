package com.kabllix.api.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "product_lots")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProductLot {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    @ToString.Exclude
    private Product product;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id", nullable = false)
    private Store store;

    @Column(length = 100)
    private String batchNumber;

    @Column(nullable = false, precision = 12, scale = 4)
    private BigDecimal quantity;

    @Column(precision = 12, scale = 2)
    private BigDecimal purchasePrice;

    private LocalDate expiryDate;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime dateAdded;
}
