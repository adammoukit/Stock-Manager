package com.kabllix.api.dto;

import com.kabllix.api.entity.Store;
import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class StoreResponseDTO {
    private UUID id;
    private String name;
    private String address;
    private String phone;

    public static StoreResponseDTO fromEntity(Store store) {
        return StoreResponseDTO.builder()
                .id(store.getId())
                .name(store.getName())
                .address(store.getAddress())
                .phone(store.getPhone())
                .build();
    }
}
