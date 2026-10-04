package com.kabllix.api.dto;

import com.kabllix.api.entity.UnitArchetype;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class ProductCreateDTO {
    private java.util.UUID storeId;

    @NotBlank
    private String name;
    private String category;
    private String supplier;
    private String barcode;

    @NotNull
    private UnitArchetype unitArchetype;
    
    @NotBlank
    private String baseUnit;

    @NotNull
    @PositiveOrZero
    private BigDecimal stockReceived; // Quantité de départ envoyée par React

    @PositiveOrZero
    private BigDecimal minStock; // Seuil d'alerte

    @NotNull
    @PositiveOrZero
    private BigDecimal conversionFactor;

    @PositiveOrZero
    private BigDecimal bulkPurchasePrice; // Montant global de la facture fournisseur

    @PositiveOrZero
    private BigDecimal purchasePrice; // Prix d'achat unitaire direct (PRU)

    @NotNull
    @PositiveOrZero
    private BigDecimal price; // Prix unitaire de vente

    private boolean hasLot;
    private boolean hasPiece;
    private BigDecimal piecePrice;
    private Integer retailStepQuantity;
    private BigDecimal lotPrice;
    private String bulkUnit;
    private BigDecimal bulkPrice;
    private boolean hasSubUnit;
    private List<PackagingOptionDTO> packagings;
}
