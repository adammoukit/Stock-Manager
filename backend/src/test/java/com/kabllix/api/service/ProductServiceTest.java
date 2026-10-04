package com.kabllix.api.service;

import com.kabllix.api.dto.ProductCreateDTO;
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
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Tests unitaires professionnels pour ProductService.
 * Standard d'entreprise : Mockito + JUnit 5 + AssertJ
 */
@ExtendWith(MockitoExtension.class)
class ProductServiceTest {

    @Mock
    private ProductRepository productRepository;

    @Mock
    private StoreRepository storeRepository;

    @Mock
    private ProductStockRepository stockRepository;

    @Mock
    private ProductLotRepository lotRepository;

    @Mock
    private StockMovementRepository movementRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private ProductService productService;

    private User mockUser;
    private Store mockStore;

    @BeforeEach
    void setUp() {
        // Simuler la boutique
        mockStore = Store.builder()
                .id(UUID.randomUUID())
                .name("Quincaillerie Principale")
                .build();

        // Simuler l'utilisateur connecté
        mockUser = User.builder()
                .id(UUID.randomUUID())
                .email("gerant@kabllix.com")
                .firstName("Koffi")
                .lastName("Mensah")
                .role(Role.ADMIN)
                .store(mockStore)
                .build();

        // Simuler le contexte de sécurité Spring Security (SecurityContextHolder)
        Authentication authentication = mock(Authentication.class);
        lenient().when(authentication.getName()).thenReturn("gerant@kabllix.com");

        SecurityContext securityContext = mock(SecurityContext.class);
        lenient().when(securityContext.getAuthentication()).thenReturn(authentication);
        SecurityContextHolder.setContext(securityContext);

        lenient().when(userRepository.findByEmail("gerant@kabllix.com")).thenReturn(Optional.of(mockUser));
        lenient().when(storeRepository.findByOwnerId(mockUser.getId())).thenReturn(List.of(mockStore));
    }

    @Test
    @DisplayName("Doit calculer automatiquement le Prix de Revient Unitaire (PRU) à partir du prix global d'achat en gros")
    void testCreateProduct_CalculatesPurchasePriceFromBulkPrice() {
        // GIVEN (Données d'entrée)
        ProductCreateDTO dto = new ProductCreateDTO();
        dto.setName("Sac de Ciment CPJ 45");
        dto.setCategory("Gros Oeuvre");
        dto.setUnitArchetype(UnitArchetype.BULK);
        dto.setBaseUnit("SAC");
        dto.setConversionFactor(BigDecimal.ONE);
        dto.setPrice(new BigDecimal("4500.00")); // Prix de vente
        dto.setStoreId(mockStore.getId());

        // Facture globale fournisseur : 400 000 FCFA pour 100 sacs reçus
        dto.setBulkPurchasePrice(new BigDecimal("400000.00"));
        dto.setStockReceived(new BigDecimal("100.00"));

        when(productRepository.save(any(Product.class))).thenAnswer(invocation -> invocation.getArgument(0));

        // WHEN (Action)
        Product createdProduct = productService.createProduct(dto);

        // THEN (Vérifications d'entreprise)
        assertThat(createdProduct).isNotNull();
        assertThat(createdProduct.getName()).isEqualTo("Sac de Ciment CPJ 45");
        assertThat(createdProduct.getOwner()).isEqualTo(mockUser);

        // Vérification de la formule : 400000 / 100 = 4000.00 FCFA
        assertThat(createdProduct.getPurchasePrice()).isEqualByComparingTo(new BigDecimal("4000.00"));

        // Vérifier que le stock et le mouvement initial ont été créés
        verify(stockRepository, times(1)).save(any(ProductStock.class));
        verify(lotRepository, times(1)).save(any(ProductLot.class));
        verify(movementRepository, times(1)).save(any(StockMovement.class));
    }

    @Test
    @DisplayName("Doit utiliser le prix d'achat direct sans recalcul s'il est explicitement fourni")
    void testCreateProduct_UsesDirectPurchasePriceWhenProvided() {
        // GIVEN
        ProductCreateDTO dto = new ProductCreateDTO();
        dto.setName("Paquet de Pointes 80mm");
        dto.setCategory("Quincaillerie");
        dto.setUnitArchetype(UnitArchetype.BOX);
        dto.setBaseUnit("PAQUET");
        dto.setConversionFactor(BigDecimal.ONE);
        dto.setPrice(new BigDecimal("3500.00"));
        dto.setPurchasePrice(new BigDecimal("2200.00")); // Prix direct
        dto.setStockReceived(new BigDecimal("10.00"));
        dto.setStoreId(mockStore.getId());

        when(productRepository.save(any(Product.class))).thenAnswer(invocation -> invocation.getArgument(0));

        // WHEN
        Product createdProduct = productService.createProduct(dto);

        // THEN
        assertThat(createdProduct.getPurchasePrice()).isEqualByComparingTo(new BigDecimal("2200.00"));
    }

    @Test
    @DisplayName("Doit enregistrer un mouvement de stock de type 'IN' avec les détails du créateur")
    void testCreateProduct_RecordsStockMovementCorrectly() {
        // GIVEN
        ProductCreateDTO dto = new ProductCreateDTO();
        dto.setName("Fer à béton 12mm");
        dto.setCategory("Métaux");
        dto.setUnitArchetype(UnitArchetype.UNIT);
        dto.setBaseUnit("BARRE");
        dto.setConversionFactor(BigDecimal.ONE);
        dto.setPrice(new BigDecimal("6500.00"));
        dto.setPurchasePrice(new BigDecimal("5000.00"));
        dto.setStockReceived(new BigDecimal("50.00"));
        dto.setStoreId(mockStore.getId());

        when(productRepository.save(any(Product.class))).thenAnswer(invocation -> invocation.getArgument(0));

        // WHEN
        productService.createProduct(dto);

        // THEN : On capture le mouvement de stock pour inspecter ses champs précis
        ArgumentCaptor<StockMovement> movementCaptor = ArgumentCaptor.forClass(StockMovement.class);
        verify(movementRepository).save(movementCaptor.capture());

        StockMovement savedMovement = movementCaptor.getValue();
        assertThat(savedMovement.getType()).isEqualTo("IN");
        assertThat(savedMovement.getQuantity()).isEqualByComparingTo(new BigDecimal("50.00"));
        assertThat(savedMovement.getReason()).isEqualTo("Création Produit");
        assertThat(savedMovement.getUserId()).isEqualTo("Koffi");
    }
}
