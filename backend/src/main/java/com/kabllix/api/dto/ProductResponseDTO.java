package com.kabllix.api.dto;

import com.kabllix.api.entity.PackagingOption;
import com.kabllix.api.entity.Product;
import com.kabllix.api.entity.ProductStock;
import com.kabllix.api.entity.UnitArchetype;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Data
public class ProductResponseDTO {

    private UUID id;
    private String name;
    private String category;
    private String supplier;
    private UnitArchetype unitArchetype;
    private String baseUnit;
    private BigDecimal conversionFactor;
    private BigDecimal purchasePrice;
    private BigDecimal bulkPurchasePrice;
    private BigDecimal price;
    private boolean hasLot;
    private Integer retailStepQuantity;
    private BigDecimal lotPrice;
    private String bulkUnit;
    private BigDecimal bulkPrice;
    private boolean hasSubUnit;
    private List<PackagingOptionResponseDTO> packagings;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    // Champs stock — alimentés depuis product_stocks (par boutique)
    private BigDecimal stockQuantity;    // Quantité stock boutique actuelle
    private BigDecimal minStockQuantity; // Seuil minimum boutique actuelle
    private Map<UUID, BigDecimal> stocksByStore;    // Multi-boutique
    private Map<UUID, BigDecimal> minStockByStore;  // Seuils multi-boutique

    @Data
    public static class PackagingOptionResponseDTO {
        private UUID id;
        private String name;
        private BigDecimal targetQty;
        private BigDecimal price;
        private BigDecimal deductionRatio;
    }

    // Méthode de conversion : Entity -> DTO (logique de mapping propre)
    // stocks : liste des ProductStock de ce produit (toutes boutiques)
    public static ProductResponseDTO fromEntity(Product p, List<ProductStock> stocks) {
        ProductResponseDTO dto = new ProductResponseDTO();
        dto.setId(p.getId());
        dto.setName(p.getName());
        dto.setCategory(p.getCategory());
        dto.setSupplier(p.getSupplier());
        dto.setUnitArchetype(p.getUnitArchetype());
        dto.setBaseUnit(p.getBaseUnit());
        dto.setConversionFactor(p.getConversionFactor());
        dto.setPurchasePrice(p.getPurchasePrice());
        dto.setBulkPurchasePrice(p.getBulkPurchasePrice());
        dto.setPrice(p.getPrice());
        dto.setHasLot(p.isHasLot());
        dto.setRetailStepQuantity(p.getRetailStepQuantity());
        dto.setLotPrice(p.getLotPrice());
        dto.setBulkUnit(p.getBulkUnit());
        dto.setBulkPrice(p.getBulkPrice());
        dto.setHasSubUnit(p.isHasSubUnit());
        dto.setCreatedAt(p.getCreatedAt());
        dto.setUpdatedAt(p.getUpdatedAt());

        if (p.getPackagings() != null) {
            dto.setPackagings(p.getPackagings().stream().map(pkg -> {
                PackagingOptionResponseDTO pkgDto = new PackagingOptionResponseDTO();
                pkgDto.setId(pkg.getId());
                pkgDto.setName(pkg.getName());
                pkgDto.setTargetQty(pkg.getTargetQty());
                pkgDto.setPrice(pkg.getPrice());
                pkgDto.setDeductionRatio(pkg.getDeductionRatio());
                return pkgDto;
            }).collect(Collectors.toList()));
        }

        // Mapper les stocks par boutique (UUID)
        if (stocks != null && !stocks.isEmpty()) {
            Map<UUID, BigDecimal> stockMap = stocks.stream()
                .filter(s -> s.getStore() != null)
                .collect(Collectors.toMap(
                    s -> s.getStore().getId(),
                    ProductStock::getQuantity
                ));
            Map<UUID, BigDecimal> minMap = stocks.stream()
                .filter(s -> s.getStore() != null)
                .collect(Collectors.toMap(
                    s -> s.getStore().getId(),
                    ProductStock::getMinQuantity
                ));
            dto.setStocksByStore(stockMap);
            dto.setMinStockByStore(minMap);
            
            // On peut définir une quantité globale ou laisser le frontend filtrer par UUID
            dto.setStockQuantity(stocks.stream().map(ProductStock::getQuantity).reduce(BigDecimal.ZERO, BigDecimal::add));
            dto.setMinStockQuantity(stocks.stream().map(ProductStock::getMinQuantity).reduce(BigDecimal.ZERO, BigDecimal::add));
        } else {
            dto.setStockQuantity(BigDecimal.ZERO);
            dto.setMinStockQuantity(BigDecimal.ZERO);
        }

        return dto;
    }

    // Surcharge sans stocks (rétrocompatibilité)
    public static ProductResponseDTO fromEntity(Product p) {
        return fromEntity(p, null);
    }
}
