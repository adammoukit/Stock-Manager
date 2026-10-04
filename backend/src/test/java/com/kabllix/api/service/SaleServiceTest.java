package com.kabllix.api.service;

import com.kabllix.api.dto.SaleItemDTO;
import com.kabllix.api.dto.SaleRequestDTO;
import com.kabllix.api.entity.*;
import com.kabllix.api.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Tests unitaires professionnels pour SaleService (Gestion des Ventes & Encaissements).
 * Teste la déduction des stocks, le calcul comptable et l'algorithme FIFO des lots.
 */
@ExtendWith(MockitoExtension.class)
class SaleServiceTest {

    @Mock
    private SaleTransactionRepository saleRepository;

    @Mock
    private ProductRepository productRepository;

    @Mock
    private ProductStockRepository stockRepository;

    @Mock
    private ProductLotRepository lotRepository;

    @Mock
    private StoreRepository storeRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private StockMovementRepository movementRepository;

    @InjectMocks
    private SaleService saleService;

    private User mockUser;
    private Store mockStore;
    private Product mockProduct;
    private ProductStock mockStock;

    @BeforeEach
    void setUp() {
        mockStore = Store.builder()
                .id(UUID.randomUUID())
                .name("Quincaillerie Centrale")
                .build();

        mockUser = User.builder()
                .id(UUID.randomUUID())
                .firstName("Ablam")
                .email("caissier@kabllix.com")
                .role(Role.CASHIER)
                .store(mockStore)
                .build();

        mockProduct = new Product();
        mockProduct.setId(UUID.randomUUID());
        mockProduct.setName("Tuyau PVC 40mm");
        mockProduct.setBaseUnit("BARRE");
        mockProduct.setPrice(new BigDecimal("2500.00"));

        mockStock = ProductStock.builder()
                .product(mockProduct)
                .store(mockStore)
                .quantity(new BigDecimal("20.00")) // 20 barres en stock
                .minQuantity(new BigDecimal("5.00"))
                .build();

        // Contexte Spring Security
        Authentication auth = mock(Authentication.class);
        lenient().when(auth.getName()).thenReturn("caissier@kabllix.com");
        SecurityContext secContext = mock(SecurityContext.class);
        lenient().when(secContext.getAuthentication()).thenReturn(auth);
        SecurityContextHolder.setContext(secContext);

        lenient().when(userRepository.findByEmail("caissier@kabllix.com")).thenReturn(Optional.of(mockUser));
        lenient().when(storeRepository.findById(mockStore.getId())).thenReturn(Optional.of(mockStore));
    }

    @Test
    @DisplayName("Doit déduire correctement la quantité vendue du stock de la boutique")
    void testProcessSale_DeductsStockCorrectly() {
        // GIVEN : Vente de 4 barres
        SaleItemDTO item = new SaleItemDTO();
        item.setProductId(mockProduct.getId());
        item.setQuantity(new BigDecimal("4.00"));
        item.setType("base");
        item.setUnitPrice(new BigDecimal("2500.00"));

        SaleRequestDTO request = new SaleRequestDTO();
        request.setStoreId(mockStore.getId());
        request.setPaymentMethod("ESPECES");
        request.setAmountGiven(new BigDecimal("10000.00"));
        request.setChangeAmount(BigDecimal.ZERO);
        request.setItems(List.of(item));

        when(productRepository.findById(mockProduct.getId())).thenReturn(Optional.of(mockProduct));
        when(stockRepository.findByProduct_IdAndStore_Id(mockProduct.getId(), mockStore.getId())).thenReturn(Optional.of(mockStock));
        when(lotRepository.findByProduct_IdAndStore_IdOrderByDateAddedAsc(any(), any())).thenReturn(List.of());
        when(saleRepository.save(any(SaleTransaction.class))).thenAnswer(i -> i.getArgument(0));

        // WHEN
        SaleTransaction transaction = saleService.processSale(request);

        // THEN
        // Le stock initial était de 20, après vente de 4, il doit rester exactement 16.00
        assertThat(mockStock.getQuantity()).isEqualByComparingTo(new BigDecimal("16.00"));
        verify(stockRepository).save(mockStock);

        // Le montant total de la transaction doit être 4 * 2500 = 10 000 FCFA
        assertThat(transaction.getTotalAmount()).isEqualByComparingTo(new BigDecimal("10000.00"));
        assertThat(transaction.getStatus()).isEqualTo("completed");
    }

    @Test
    @DisplayName("Doit appliquer l'algorithme FIFO sur les lots lors d'une sortie de stock")
    void testProcessSale_DeductsFromLotsUsingFIFO() {
        // GIVEN : 2 lots existants pour ce produit :
        // Lot 1 (le plus ancien) : 3 barres
        // Lot 2 (plus récent) : 10 barres
        ProductLot lot1 = ProductLot.builder()
                .id(UUID.randomUUID())
                .batchNumber("LOT-ANCIEN-001")
                .quantity(new BigDecimal("3.00"))
                .dateAdded(LocalDateTime.now().minusDays(10))
                .build();

        ProductLot lot2 = ProductLot.builder()
                .id(UUID.randomUUID())
                .batchNumber("LOT-RECENT-002")
                .quantity(new BigDecimal("10.00"))
                .dateAdded(LocalDateTime.now().minusDays(2))
                .build();

        // Le client achète 5 barres (doit vider les 3 barres de lot1, et prendre 2 barres sur lot2)
        SaleItemDTO item = new SaleItemDTO();
        item.setProductId(mockProduct.getId());
        item.setQuantity(new BigDecimal("5.00"));
        item.setType("base");
        item.setUnitPrice(new BigDecimal("2500.00"));

        SaleRequestDTO request = new SaleRequestDTO();
        request.setStoreId(mockStore.getId());
        request.setPaymentMethod("T-MONEY");
        request.setItems(List.of(item));

        when(productRepository.findById(mockProduct.getId())).thenReturn(Optional.of(mockProduct));
        when(stockRepository.findByProduct_IdAndStore_Id(mockProduct.getId(), mockStore.getId())).thenReturn(Optional.of(mockStock));
        when(lotRepository.findByProduct_IdAndStore_IdOrderByDateAddedAsc(mockProduct.getId(), mockStore.getId()))
                .thenReturn(List.of(lot1, lot2));
        when(saleRepository.save(any(SaleTransaction.class))).thenAnswer(i -> i.getArgument(0));

        // WHEN
        saleService.processSale(request);

        // THEN : Vérification FIFO (First In First Out)
        // Lot 1 doit être complètement épuisé (0)
        assertThat(lot1.getQuantity()).isEqualByComparingTo(BigDecimal.ZERO);
        // Lot 2 doit avoir perdu 2 barres (10 - 2 = 8 barres restantes)
        assertThat(lot2.getQuantity()).isEqualByComparingTo(new BigDecimal("8.00"));

        verify(lotRepository, atLeast(2)).save(any(ProductLot.class));
    }

    @Test
    @DisplayName("Doit créer un mouvement de stock de type 'OUT' étiqueté 'Vente POS'")
    void testProcessSale_CreatesOutStockMovement() {
        SaleItemDTO item = new SaleItemDTO();
        item.setProductId(mockProduct.getId());
        item.setQuantity(new BigDecimal("2.00"));
        item.setType("base");
        item.setUnitPrice(new BigDecimal("2500.00"));

        SaleRequestDTO request = new SaleRequestDTO();
        request.setStoreId(mockStore.getId());
        request.setPaymentMethod("FLOOZ");
        request.setItems(List.of(item));

        when(productRepository.findById(mockProduct.getId())).thenReturn(Optional.of(mockProduct));
        when(stockRepository.findByProduct_IdAndStore_Id(mockProduct.getId(), mockStore.getId())).thenReturn(Optional.of(mockStock));
        when(lotRepository.findByProduct_IdAndStore_IdOrderByDateAddedAsc(any(), any())).thenReturn(List.of());
        when(saleRepository.save(any(SaleTransaction.class))).thenAnswer(i -> i.getArgument(0));

        // WHEN
        saleService.processSale(request);

        // THEN : Capture du mouvement
        ArgumentCaptor<StockMovement> captor = ArgumentCaptor.forClass(StockMovement.class);
        verify(movementRepository).save(captor.capture());

        StockMovement movement = captor.getValue();
        assertThat(movement.getType()).isEqualTo("OUT");
        assertThat(movement.getReason()).isEqualTo("Vente POS");
        assertThat(movement.getQuantity()).isEqualByComparingTo(new BigDecimal("2.00"));
        assertThat(movement.getUserId()).isEqualTo("Ablam");
    }
}
