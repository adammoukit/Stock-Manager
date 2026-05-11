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
