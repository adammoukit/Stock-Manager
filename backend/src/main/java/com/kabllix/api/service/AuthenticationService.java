package com.kabllix.api.service;

import com.kabllix.api.dto.auth.AuthenticationRequest;
import com.kabllix.api.dto.auth.AuthenticationResponse;
import com.kabllix.api.dto.auth.RegisterRequest;
import com.kabllix.api.entity.Role;
import com.kabllix.api.entity.Store;
import com.kabllix.api.entity.User;
import com.kabllix.api.repository.StoreRepository;
import com.kabllix.api.repository.UserRepository;
import com.kabllix.api.security.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthenticationService {

    private final UserRepository repository;
    private final StoreRepository storeRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;

    @Transactional
    public AuthenticationResponse register(RegisterRequest request) {
        // 1. Créer l'utilisateur d'abord (sans boutique pour l'instant)
        var user = User.builder()
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .role(Role.ADMIN)
                .isActive(true)
                .build();

        user = repository.save(user);

        // 2. Créer la boutique principale liée à cet utilisateur
        Store store = Store.builder()
                .name(request.getStoreName())
                .address(request.getStoreAddress())
                .phone(request.getPhone())
                .owner(user) // L'utilisateur est le propriétaire
                .build();

        Store savedStore = storeRepository.save(store);

        // 3. Mettre à jour l'utilisateur avec sa boutique par défaut
        user.setStore(savedStore);
        repository.save(user);

        var jwtToken = jwtService.generateToken(user);

        return AuthenticationResponse.builder()
                .token(jwtToken)
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .role(user.getRole().name())
                .build();
    }

    public AuthenticationResponse authenticate(AuthenticationRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        request.getEmail(),
                        request.getPassword()
                )
        );

        var user = repository.findByEmail(request.getEmail())
                .orElseThrow();

        var jwtToken = jwtService.generateToken(user);

        return AuthenticationResponse.builder()
                .token(jwtToken)
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .role(user.getRole().name())
                .build();
    }
}
