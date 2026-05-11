package com.kabllix.api.entity;

public enum UnitArchetype {
    UNIT,   // Le produit se vend tel quel (ex: Marteau)
    BOX,    // Le produit est une boîte/carton contenant X pièces (ex: Boîte de vis)
    BULK    // Le produit est fractionnable au poids/volume (ex: Sac de ciment, Peinture)
}
