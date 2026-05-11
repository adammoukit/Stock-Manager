package com.kabllix.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.Map;

@RestController
@CrossOrigin(origins = "*")
public class HealthController {

    @GetMapping("/")
    public ResponseEntity<Map<String, Object>> home() {
        return ResponseEntity.ok(Map.of(
            "app",     "Kabllix API",
            "version", "1.0.0",
            "status",  "operational",
            "message", "Bienvenue SALAM sur l'API Kabllix — Système de gestion de quincaillerie",
            "time",    LocalDateTime.now().toString()
        ));
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of(
            "status",   "UP",
            "database", "PostgreSQL connecté"
        ));
    }
}
