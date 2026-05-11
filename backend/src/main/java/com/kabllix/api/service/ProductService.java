package com.kabllix.api.service;

import com.kabllix.api.dto.PackagingOptionDTO;
import com.kabllix.api.dto.ProductCreateDTO;
import com.kabllix.api.entity.*;
import com.kabllix.api.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;

@Service
@RequiredArgsConstructor
public class ProductService {

    private final ProductRepository productRepository;
    private final StoreRepository storeRepository;
    private final ProductStockRepository stockRepository;
    private final ProductLotRepository lotRepository;
    private final StockMovementRepository movementRepository;
    private final UserRepository userRepository;

    private User getCurrentUser() {
        String email = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
            .orElseThrow(() -> new RuntimeException("Utilisateur non trouvé dans le contexte de sécurité"));
    }

    @Transactional
    public Product createProduct(ProductCreateDTO dto) {
        User currentUser = getCurrentUser();
        
        Product product = new Product();
        product.setName(dto.getName());
        product.setCategory(dto.getCategory());
        product.setSupplier(dto.getSupplier());
        product.setUnitArchetype(dto.getUnitArchetype());
        product.setBaseUnit(dto.getBaseUnit());
        product.setConversionFactor(dto.getConversionFactor());
        product.setBulkPurchasePrice(dto.getBulkPurchasePrice());
        product.setPrice(dto.getPrice());
        product.setBulkUnit(dto.getBulkUnit());
        product.setBulkPrice(dto.getBulkPrice());
        product.setOwner(currentUser); // Attribution du propriétaire

        // Options LOT (Vente en boîte/pack)
        product.setHasLot(dto.isHasLot());
        if (dto.isHasLot() && dto.getRetailStepQuantity() != null) {
            product.setRetailStepQuantity(dto.getRetailStepQuantity());
            product.setLotPrice(dto.getLotPrice());
        } else {
            product.setRetailStepQuantity(1);
        }

        // CALCUL SÉCURISÉ DU PRIX DE REVIENT UNITAIRE (PRU)
        if (dto.getBulkPurchasePrice() != null && dto.getStockReceived() != null 
            && dto.getStockReceived().compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal prUnit = dto.getBulkPurchasePrice().divide(dto.getStockReceived(), 2, RoundingMode.HALF_UP);
            product.setPurchasePrice(prUnit);
        } else {
            product.setPurchasePrice(BigDecimal.ZERO);
        }

        // VENTE FRACTIONNÉE
        product.setHasSubUnit(dto.isHasSubUnit());
        if (dto.isHasSubUnit() && dto.getPackagings() != null) {
            for (PackagingOptionDTO pkgDto : dto.getPackagings()) {
                PackagingOption option = new PackagingOption();
                option.setName(pkgDto.getName());
                option.setTargetQty(pkgDto.getTargetQty());
                option.setPrice(pkgDto.getPrice());
                BigDecimal ratio = pkgDto.getTargetQty().divide(dto.getConversionFactor(), 6, RoundingMode.HALF_UP);
                option.setDeductionRatio(ratio);
                product.addPackaging(option);
            }
        }

        // 1. Sauvegarder le produit
        product = productRepository.save(product);

        // =================================================================
        // GESTION DU STOCK MULTI-BOUTIQUE (Initialisation pour TOUTES les boutiques du owner)
        // =================================================================
        java.util.List<Store> userStores = storeRepository.findByOwnerId(currentUser.getId());
        
        // On récupère la boutique active (celle depuis laquelle on crée le produit)
        // Si non précisée dans le DTO, on prend la boutique par défaut du user
        java.util.UUID activeStoreId = dto.getStoreId() != null ? dto.getStoreId() : currentUser.getStore().getId();

        for (Store store : userStores) {
            boolean isActiveStore = store.getId().equals(activeStoreId);
            BigDecimal initialQty = isActiveStore && dto.getStockReceived() != null ? dto.getStockReceived() : BigDecimal.ZERO;

            // 2. Créer l'entrée de stock pour cette boutique
            ProductStock stock = ProductStock.builder()
                .product(product)
                .store(store)
                .quantity(initialQty)
                .minQuantity(isActiveStore && dto.getMinStock() != null ? dto.getMinStock() : BigDecimal.ZERO)
                .build();
            stockRepository.save(stock);

            // 3. Créer le lot et mouvement seulement s'il y a du stock (généralement uniquement pour la boutique active)
            if (initialQty.compareTo(BigDecimal.ZERO) > 0) {
                ProductLot lot = ProductLot.builder()
                    .product(product)
                    .store(store)
                    .batchNumber("INIT-BATCH")
                    .quantity(initialQty)
                    .purchasePrice(product.getPurchasePrice())
                    .build();
                lotRepository.save(lot);

                StockMovement movement = StockMovement.builder()
                    .product(product)
                    .store(store)
                    .lot(lot)
                    .type("IN")
                    .quantity(initialQty)
                    .unit(product.getBaseUnit())
                    .reason("Création Produit")
                    .userId(currentUser.getFirstName())
                    .build();
                movementRepository.save(movement);
            }
        }

        return product;
    }

    public java.util.List<Product> getAllProductsForCurrentUser() {
        return productRepository.findByOwnerId(getCurrentUser().getId());
    }

    @Transactional
    public Product updateProduct(java.util.UUID id, ProductCreateDTO dto) {
        User currentUser = getCurrentUser();
        Product product = productRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Produit introuvable"));
        
        // Vérification de sécurité : Seul le propriétaire peut modifier
        if (!product.getOwner().getId().equals(currentUser.getId())) {
            throw new RuntimeException("Accès non autorisé à ce produit");
        }

        product.setName(dto.getName());
        product.setCategory(dto.getCategory());
        product.setSupplier(dto.getSupplier());
        product.setUnitArchetype(dto.getUnitArchetype());
        product.setBaseUnit(dto.getBaseUnit());
        product.setConversionFactor(dto.getConversionFactor());
        product.setBulkPurchasePrice(dto.getBulkPurchasePrice());
        product.setBulkUnit(dto.getBulkUnit());
        product.setBulkPrice(dto.getBulkPrice());
        product.setPrice(dto.getPrice());

        product.setHasLot(dto.isHasLot());
        if (dto.isHasLot()) {
            product.setRetailStepQuantity(dto.getRetailStepQuantity() != null ? dto.getRetailStepQuantity() : 1);
            product.setLotPrice(dto.getLotPrice());
        } else {
            product.setRetailStepQuantity(1);
            product.setLotPrice(null);
        }

        if (dto.getBulkPurchasePrice() != null && dto.getStockReceived() != null 
            && dto.getStockReceived().compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal prUnit = dto.getBulkPurchasePrice().divide(dto.getStockReceived(), 2, RoundingMode.HALF_UP);
            product.setPurchasePrice(prUnit);
        }

        product.setHasSubUnit(dto.isHasSubUnit());
        product.getPackagings().clear();
        if (dto.isHasSubUnit() && dto.getPackagings() != null) {
            for (PackagingOptionDTO pkgDto : dto.getPackagings()) {
                PackagingOption option = new PackagingOption();
                option.setName(pkgDto.getName());
                option.setTargetQty(pkgDto.getTargetQty());
                option.setPrice(pkgDto.getPrice());
                BigDecimal ratio = pkgDto.getTargetQty().divide(dto.getConversionFactor(), 6, RoundingMode.HALF_UP);
                option.setDeductionRatio(ratio);
                product.addPackaging(option);
            }
        }

        // Mise à jour du stock pour la boutique active spécifiée
        java.util.UUID storeId = dto.getStoreId() != null ? dto.getStoreId() : currentUser.getStore().getId();
        stockRepository.findByProduct_IdAndStore_Id(product.getId(), storeId)
            .ifPresent(stock -> {
                if (dto.getStockReceived() != null) {
                    stock.setQuantity(dto.getStockReceived());
                }
                if (dto.getMinStock() != null) {
                    stock.setMinQuantity(dto.getMinStock());
                }
                stockRepository.save(stock);
            });

        return productRepository.save(product);
    }
}
