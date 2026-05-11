package com.kabllix.api.dto.auth;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class RegisterRequest {
    // Informations personnelles de l'administrateur
    private String firstName;
    private String lastName;
    private String email;
    private String password;
    private String phone;

    // Informations de la quincaillerie (boutique principale)
    private String storeName;
    private String storeAddress;
}
