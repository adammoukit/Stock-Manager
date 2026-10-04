package com.kabllix.api.controller;

import com.kabllix.api.dto.ProductCreateDTO;
import com.kabllix.api.dto.ProductResponseDTO;
import com.kabllix.api.entity.Product;
import com.kabllix.api.entity.ProductStock;
import com.kabllix.api.repository.ProductRepository;
import com.kabllix.api.repository.ProductStockRepository;
import com.kabllix.api.service.ProductService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
public class ProductController {

    private final ProductService productService;
    private final ProductRepository productRepository;
    private final ProductStockRepository stockRepository;
    private final com.kabllix.api.repository.UserRepository userRepository;

    // GET /api/products/barcode/{barcode} — Recherche rapide par code-barre
    @GetMapping("/barcode/{barcode}")
    @Transactional(readOnly = true)
    public ResponseEntity<ProductResponseDTO> getByBarcode(@PathVariable String barcode) {
        String email = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .flatMap(user -> productRepository.findByBarcodeAndOwnerId(barcode.trim(), user.getId()))
                .map(p -> {
                    List<ProductStock> stocks = stockRepository.findByProductId(p.getId());
                    return ResponseEntity.ok(ProductResponseDTO.fromEntity(p, stocks));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * GET /api/products/generate-barcode
     * Génère un code EAN-13 interne unique (préfixe 200) garanti libre en base
     * pour le propriétaire connecté.
     *
     * ⚠️ Cet endpoint n'est JAMAIS appelé automatiquement.
     * Il est déclenché UNIQUEMENT par un clic explicite du gérant sur « 🎲 Générer ».
     * Si le gérant oublie de renseigner le code-barres, le produit est créé sans code.
     */
    @GetMapping("/generate-barcode")
    @Transactional(readOnly = true)
    public ResponseEntity<java.util.Map<String, String>> generateBarcode() {
        String email = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName();
        java.util.UUID ownerId = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Utilisateur non trouvé"))
                .getId();

        String barcode = generateUniqueEan13(ownerId);
        return ResponseEntity.ok(java.util.Map.of("barcode", barcode));
    }

    /**
     * Génère un code EAN-13 interne unique pour le propriétaire.
     * Format : 200 + 9 chiffres (horodatage + aléatoire) + clé de contrôle.
     * Vérifie en base qu'il n'existe pas déjà avant de le retourner.
     */
    private String generateUniqueEan13(java.util.UUID ownerId) {
        final String PREFIX = "200";
        int attempts = 0;

        while (attempts < 20) {
            // Corps de 9 chiffres : base temporelle + entropie pour éviter les collisions
            long timeComponent = (System.currentTimeMillis() / 1000L) % 100000L;
            long randomComponent = (long) (Math.random() * 10000L);
            String body = String.format("%05d%04d", timeComponent, randomComponent);
            String first12 = PREFIX + body; // 3 + 9 = 12 chiffres

            // Calcul de la clé de contrôle EAN-13 (modulo 10)
            int sum = 0;
            for (int i = 0; i < 12; i++) {
                int digit = Character.getNumericValue(first12.charAt(i));
                sum += (i % 2 == 0) ? digit : digit * 3;
            }
            int checkDigit = (10 - (sum % 10)) % 10;
            String candidate = first12 + checkDigit;

            // Vérification d'unicité en base avant de retourner
            if (!productRepository.existsByBarcodeAndOwnerId(candidate, ownerId)) {
                return candidate;
            }
            attempts++;
        }
        throw new RuntimeException("Impossible de générer un code-barres unique après 20 tentatives");
    }

    // POST /api/products — Créer un produit
    @PostMapping
    public ResponseEntity<ProductResponseDTO> create(@Valid @RequestBody ProductCreateDTO dto) {
        Product saved = productService.createProduct(dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(ProductResponseDTO.fromEntity(saved));
    }

    /**
     * GET /api/products — Lister tous les produits
     *
     * @Transactional(readOnly = true) maintient la session Hibernate ouverte
     * pendant toute la durée de la méthode, permettant l'accès aux collections
     * LAZY (ex: packagings) lors du mapping vers le DTO.
     * Sans cela → LazyInitializationException.
     */
    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<List<ProductResponseDTO>> getAll() {
        List<ProductResponseDTO> products = productService.getAllProductsForCurrentUser()
                .stream()
                .map(p -> {
                    List<ProductStock> stocks = stockRepository.findByProductId(p.getId());
                    return ProductResponseDTO.fromEntity(p, stocks);
                })
                .collect(Collectors.toList());
        return ResponseEntity.ok(products);
    }

    // GET /api/products/{id} — Détail d'un produit
    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public ResponseEntity<ProductResponseDTO> getById(@PathVariable UUID id) {
        return productRepository.findById(id)
                .map(p -> {
                    // Sécurité : Vérifier le propriétaire
                    // (On pourrait faire ça dans un aspect ou via Spring Security @PostAuthorize)
                    // Mais on le fait ici pour la clarté
                    if (!p.getOwner().getEmail().equals(org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName())) {
                        return ResponseEntity.status(HttpStatus.FORBIDDEN).<ProductResponseDTO>build();
                    }
                    List<ProductStock> stocks = stockRepository.findByProductId(p.getId());
                    return ResponseEntity.ok(ProductResponseDTO.fromEntity(p, stocks));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    // PUT /api/products/{id} — Modifier un produit
    @PutMapping("/{id}")
    public ResponseEntity<ProductResponseDTO> update(@PathVariable UUID id, @Valid @RequestBody ProductCreateDTO dto) {
        Product updated = productService.updateProduct(id, dto);
        return ResponseEntity.ok(ProductResponseDTO.fromEntity(updated));
    }

    // DELETE /api/products/{id} — Supprimer un produit
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        Product p = productRepository.findById(id).orElse(null);
        if (p == null) return ResponseEntity.notFound().build();
        
        // Sécurité
        if (!p.getOwner().getEmail().equals(org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        
        productRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
