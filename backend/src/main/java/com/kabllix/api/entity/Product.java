package com.kabllix.api.entity;

import jakarta.persistence.*;
import java.util.UUID;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "products")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(length = 100)
    private String category;

    @Column(length = 100)
    private String supplier;

    // --- LOGIQUE DE STOCK ET D'UNITÉ ---

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private UnitArchetype unitArchetype;

    @Column(nullable = false, length = 50)
    private String baseUnit; // ex: "Boîte", "Sac de ciment"

    @Column(nullable = false, precision = 10, scale = 4)
    private BigDecimal conversionFactor; // ex: 50 (pour 50kg) ou 100 (pour 100 pièces)

    // --- LOGIQUE FINANCIÈRE ---

    @Column(precision = 12, scale = 2)
    private BigDecimal bulkPurchasePrice; // Optionnel : Ce qu'on a payé pour tout le lot (historique/tracing)

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal purchasePrice; // PRU calculé : Coût de revient d'1 baseUnit

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal price; // Prix de vente classique pour 1 baseUnit

    // --- OPTIONS DE VENTE MULTI-MODALES (BOX) ---

    @Column(nullable = false)
    private boolean hasLot;

    @Column(name = "retail_step_quantity", nullable = false)
    @Builder.Default
    private Integer retailStepQuantity = 1; // ex: 10 pièces

    @Column(precision = 12, scale = 2)
    private BigDecimal lotPrice; // Prix pour le lot

    // --- VENTE EN GROS (Optionnel) ---
    @Column(length = 50)
    private String bulkUnit; // ex: "Carton", "Sac"

    @Column(precision = 12, scale = 2)
    private BigDecimal bulkPrice; // Prix de vente en gros

    // --- VENTE FRACTIONNÉE (BULK) ---

    @Column(nullable = false)
    private boolean hasSubUnit;

    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<PackagingOption> packagings = new ArrayList<>();

    // Méthode utilitaire pour gérer la relation bi-directionnelle
    public void addPackaging(PackagingOption packaging) {
        packagings.add(packaging);
        packaging.setProduct(this);
    }

    public void removePackaging(PackagingOption packaging) {
        packagings.remove(packaging);
        packaging.setProduct(null);
    }

    // --- AUDIT ---

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
