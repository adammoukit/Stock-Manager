package com.kabllix.api.repository;

import com.kabllix.api.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {
    // Cette méthode est vitale pour Spring Security (pour trouver qui se connecte)
    Optional<User> findByEmail(String email);
}
