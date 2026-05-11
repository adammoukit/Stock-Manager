package com.kabllix.api.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "stock_movements")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StockMovement {

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

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lot_id")
    private ProductLot lot;

    @Column(nullable = false, length = 10)
    private String type; // 'IN' ou 'OUT'

    @Column(nullable = false, precision = 12, scale = 4)
    private BigDecimal quantity;

    @Column(length = 50)
    private String unit;

    @Column(length = 100)
    private String reason;

    @Column(length = 50)
    private String userId;

    private String details;

    @CreationTimestamp
    @Column(name = "date", updatable = false)
    private LocalDateTime date;
}
