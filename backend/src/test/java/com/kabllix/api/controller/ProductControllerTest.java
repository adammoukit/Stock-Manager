package com.kabllix.api.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kabllix.api.dto.ProductCreateDTO;
import com.kabllix.api.entity.Role;
import com.kabllix.api.entity.User;
import com.kabllix.api.repository.ProductRepository;
import com.kabllix.api.repository.ProductStockRepository;
import com.kabllix.api.repository.UserRepository;
import com.kabllix.api.service.ProductService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.Optional;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Test du Contrôleur Web (HTTP Layer) avec MockMvc.
 * Vérifie les codes de statut HTTP, la validation JSON et le routage REST.
 */
@ExtendWith(MockitoExtension.class)
class ProductControllerTest {

    private MockMvc mockMvc;

    @Mock
    private ProductService productService;

    @Mock
    private ProductRepository productRepository;

    @Mock
    private ProductStockRepository stockRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private ProductController productController;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private User mockUser;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(productController).build();

        mockUser = User.builder()
                .id(UUID.randomUUID())
                .email("admin@kabllix.com")
                .firstName("Admin")
                .role(Role.ADMIN)
                .build();

        // Contexte de sécurité Spring Security
        Authentication auth = mock(Authentication.class);
        when(auth.getName()).thenReturn("admin@kabllix.com");
        SecurityContext secContext = mock(SecurityContext.class);
        when(secContext.getAuthentication()).thenReturn(auth);
        SecurityContextHolder.setContext(secContext);
    }

    @Test
    @DisplayName("GET /api/products/generate-barcode doit générer un code-barres EAN-13 valide (13 chiffres)")
    void testGenerateBarcode_ReturnsValidEan13() throws Exception {
        when(userRepository.findByEmail("admin@kabllix.com")).thenReturn(Optional.of(mockUser));
        // Simuler que le code-barre n'existe pas encore en base
        when(productRepository.existsByBarcodeAndOwnerId(anyString(), eq(mockUser.getId()))).thenReturn(false);

        mockMvc.perform(get("/api/products/generate-barcode")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.barcode").exists())
                // Doit commencer par 200 (préfixe interne Kabllix)
                .andExpect(jsonPath("$.barcode", startsWith("200")))
                // Doit faire exactement 13 caractères (Standard international EAN-13)
                .andExpect(jsonPath("$.barcode", hasLength(13)));
    }

    @Test
    @DisplayName("POST /api/products sans nom obligatoire doit retourner 400 Bad Request")
    void testCreateProduct_WhenNameIsMissing_ReturnsBadRequest() throws Exception {
        // Corps de requête incomplet (nom manquant)
        ProductCreateDTO invalidDto = new ProductCreateDTO();
        invalidDto.setName(null); // @NotBlank violé !

        mockMvc.perform(post("/api/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidDto)))
                .andExpect(status().isBadRequest());
    }
}
