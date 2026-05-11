package com.kabllix.api.service;

import com.kabllix.api.dto.SaleItemDTO;
import com.kabllix.api.dto.SaleRequestDTO;
import com.kabllix.api.dto.SaleTransactionResponseDTO;
import com.kabllix.api.entity.*;
import com.kabllix.api.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

@Service
@RequiredArgsConstructor
public class SaleService {

    private final SaleTransactionRepository saleRepository;
    private final ProductRepository productRepository;
    private final ProductStockRepository stockRepository;
    private final ProductLotRepository lotRepository;
    private final StoreRepository storeRepository;
    private final UserRepository userRepository;
    private final StockMovementRepository movementRepository;

    private User getCurrentUser() {
        String email = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
            .orElseThrow(() -> new RuntimeException("Utilisateur non trouvé"));
    }

    @Transactional
    public SaleTransaction processSale(SaleRequestDTO request) {
        User currentUser = getCurrentUser();
        Store store = storeRepository.findById(request.getStoreId())
            .orElseThrow(() -> new RuntimeException("Boutique non trouvée"));

        SaleTransaction transaction = new SaleTransaction();
        transaction.setStore(store);
        transaction.setUser(currentUser);
        transaction.setPaymentMethod(request.getPaymentMethod());
        transaction.setAmountGiven(request.getAmountGiven());
        transaction.setChangeAmount(request.getChangeAmount());
        transaction.setStatus("completed");
        
        BigDecimal totalAmount = BigDecimal.ZERO;

        for (SaleItemDTO itemDto : request.getItems()) {
            Product product = productRepository.findById(itemDto.getProductId())
                .orElseThrow(() -> new RuntimeException("Produit non trouvé: " + itemDto.getProductId()));

            BigDecimal deductionQty = calculateBaseDeduction(product, itemDto);
            
            // 1. Déduire du stock principal
            ProductStock stock = stockRepository.findByProduct_IdAndStore_Id(product.getId(), store.getId())
                .orElseThrow(() -> new RuntimeException("Stock non trouvé pour le produit: " + product.getName()));
            
            if (stock.getQuantity().compareTo(deductionQty) < 0) {
                // Pour une plateforme financière, on peut décider de bloquer la vente si stock insuffisant, 
                // mais souvent en POS on autorise le stock négatif. On va l'autoriser ici.
            }
            stock.setQuantity(stock.getQuantity().subtract(deductionQty));
            stockRepository.save(stock);

            // 2. Déduire des lots (FIFO)
            List<ProductLot> lots = lotRepository.findByProduct_IdAndStore_IdOrderByDateAddedAsc(product.getId(), store.getId());
            BigDecimal remainingToDeduct = deductionQty;

            for (ProductLot lot : lots) {
                if (remainingToDeduct.compareTo(BigDecimal.ZERO) <= 0) break;

                if (lot.getQuantity().compareTo(remainingToDeduct) >= 0) {
                    lot.setQuantity(lot.getQuantity().subtract(remainingToDeduct));
                    lotRepository.save(lot);
                    remainingToDeduct = BigDecimal.ZERO;
                } else {
                    remainingToDeduct = remainingToDeduct.subtract(lot.getQuantity());
                    lot.setQuantity(BigDecimal.ZERO);
                    lotRepository.save(lot);
                }
            }

            // 3. Tracer le mouvement
            StockMovement movement = StockMovement.builder()
                .product(product)
                .store(store)
                .type("OUT")
                .quantity(deductionQty)
                .unit(product.getBaseUnit())
                .reason("Vente POS")
                .userId(currentUser.getFirstName())
                .build();
            movementRepository.save(movement);

            // 4. Ajouter à la transaction
            BigDecimal itemTotal = itemDto.getUnitPrice().multiply(itemDto.getQuantity());
            totalAmount = totalAmount.add(itemTotal);

            SaleItem saleItem = new SaleItem();
            saleItem.setProduct(product);
            saleItem.setQuantity(itemDto.getQuantity());
            saleItem.setSaleType(itemDto.getType());
            saleItem.setUnitPrice(itemDto.getUnitPrice());
            saleItem.setTotalPrice(itemTotal);
            saleItem.setBaseStockDeduction(deductionQty);
            
            transaction.addItem(saleItem);
        }

        transaction.setTotalAmount(totalAmount);
        return saleRepository.save(transaction);
    }

    @Transactional(readOnly = true)
    public List<SaleTransactionResponseDTO> getTransactionsByStore(java.util.UUID storeId) {
        List<SaleTransaction> transactions = saleRepository.findByStore_IdOrderByTransactionDateDesc(storeId);
        return transactions.stream().map(this::mapToResponseDTO).toList();
    }

    private SaleTransactionResponseDTO mapToResponseDTO(SaleTransaction transaction) {
        SaleTransactionResponseDTO dto = new SaleTransactionResponseDTO();
        dto.setId(transaction.getId());
        dto.setStoreId(transaction.getStore().getId());
        dto.setTotalAmount(transaction.getTotalAmount());
        dto.setPaymentMethod(transaction.getPaymentMethod());
        dto.setAmountGiven(transaction.getAmountGiven());
        dto.setChangeAmount(transaction.getChangeAmount());
        dto.setStatus(transaction.getStatus());
        dto.setTransactionDate(transaction.getTransactionDate());
        
        List<com.kabllix.api.dto.SaleItemResponseDTO> itemDTOs = transaction.getItems().stream().map(item -> {
            com.kabllix.api.dto.SaleItemResponseDTO itemDto = new com.kabllix.api.dto.SaleItemResponseDTO();
            itemDto.setId(item.getId());
            itemDto.setProductId(item.getProduct().getId());
            itemDto.setProductName(item.getProduct().getName());
            itemDto.setProductUnit(item.getProduct().getBaseUnit());
            itemDto.setQuantity(item.getQuantity());
            itemDto.setSaleType(item.getSaleType());
            itemDto.setUnitPrice(item.getUnitPrice());
            itemDto.setTotalPrice(item.getTotalPrice());
            return itemDto;
        }).toList();
        
        dto.setItems(itemDTOs);
        return dto;
    }

    /**
     * Calcule la quantité exacte à déduire de l'unité de base (baseUnit) du produit.
     * Logique de conditionnement extrêmement minutieuse.
     */
    private BigDecimal calculateBaseDeduction(Product product, SaleItemDTO itemDto) {
        BigDecimal inputQty = itemDto.getQuantity();
        
        if ("packaging".equals(itemDto.getType())) {
            // Recherche du packaging spécifique
            PackagingOption packaging = product.getPackagings().stream()
                .filter(p -> p.getName().equals(itemDto.getPackagingName()))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("Option de packaging introuvable: " + itemDto.getPackagingName()));
            
            // inputQty * deductionRatio
            return inputQty.multiply(packaging.getDeductionRatio()).setScale(6, RoundingMode.HALF_UP);
            
        } else if ("lot".equals(itemDto.getType())) {
            BigDecimal lotQty = new BigDecimal(product.getRetailStepQuantity());
            BigDecimal cf = product.getConversionFactor() != null ? product.getConversionFactor() : BigDecimal.ONE;
            
            boolean isContainer = ("BOX".equals(product.getUnitArchetype().name()) || "BULK".equals(product.getUnitArchetype().name())) 
                                  && cf.compareTo(BigDecimal.ONE) > 0;
                                  
            BigDecimal baseDeductionPerLot;
            if (isContainer) {
                // fraction du conteneur = lotQty / cf
                baseDeductionPerLot = lotQty.divide(cf, 6, RoundingMode.HALF_UP);
            } else {
                baseDeductionPerLot = lotQty;
            }
            return inputQty.multiply(baseDeductionPerLot).setScale(6, RoundingMode.HALF_UP);
            
        } else {
            // type = base
            return inputQty.setScale(6, RoundingMode.HALF_UP);
        }
    }
}
