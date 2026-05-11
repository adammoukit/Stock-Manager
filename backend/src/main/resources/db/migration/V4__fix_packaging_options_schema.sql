-- ============================================================
-- V4 : Correction schema packaging_options
--
-- L'entité PackagingOption.java utilise `targetQty` (NUMERIC)
-- mais la table a été créée avec `target_unit` (VARCHAR).
-- Cette migration aligne la BDD sur l'entité Java.
-- ============================================================

-- 1. Ajouter la colonne manquante (avec valeur par défaut 0 pour les lignes existantes)
ALTER TABLE packaging_options
    ADD COLUMN IF NOT EXISTS target_qty NUMERIC(10, 4) NOT NULL DEFAULT 0;

-- 2. Supprimer l'ancienne colonne devenue obsolète
ALTER TABLE packaging_options
    DROP COLUMN IF EXISTS target_unit;
