package com.kabllix.api.controller;

import com.kabllix.api.dto.StoreResponseDTO;
import com.kabllix.api.entity.User;
import com.kabllix.api.repository.StoreRepository;
import com.kabllix.api.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/stores")
@RequiredArgsConstructor
public class StoreController {

    private final StoreRepository storeRepository;
    private final UserRepository userRepository;

    @GetMapping
    public ResponseEntity<List<StoreResponseDTO>> getMyStores() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Utilisateur non trouvé"));

        List<StoreResponseDTO> stores = storeRepository.findByOwnerId(user.getId())
                .stream()
                .map(StoreResponseDTO::fromEntity)
                .collect(Collectors.toList());

        return ResponseEntity.ok(stores);
    }
}
