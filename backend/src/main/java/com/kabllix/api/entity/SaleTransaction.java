package com.kabllix.api.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "sale_transactions")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SaleTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id", nullable = false)
    @com.fasterxml.jackson.annotation.JsonIgnore
    private Store store;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    @com.fasterxml.jackson.annotation.JsonIgnore
    private User user;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal totalAmount;

    @Column(nullable = false, length = 50)
    private String paymentMethod; // cash, card, credit

    @Column(precision = 12, scale = 2)
    private BigDecimal amountGiven;

    @Column(precision = 12, scale = 2)
    private BigDecimal changeAmount;

    @Column(nullable = false, length = 50)
    private String status; // completed, canceled

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime transactionDate;

    @OneToMany(mappedBy = "transaction", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<SaleItem> items = new ArrayList<>();

    public void addItem(SaleItem item) {
        items.add(item);
        item.setTransaction(this);
    }
}
