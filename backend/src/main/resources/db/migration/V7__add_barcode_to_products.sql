-- ============================================================
-- V7 : Ajout du champ code-barres (barcode) aux produits
-- ============================================================

-- 1. Ajout de la colonne barcode
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS barcode VARCHAR(50);

-- 2. Index pour recherche instantanée au scan à la caisse
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);

-- 3. Contrainte d'unicité par propriétaire (pour les codes non nuls et non vides)
CREATE UNIQUE INDEX IF NOT EXISTS uq_products_owner_barcode 
ON products(owner_id, barcode) 
WHERE barcode IS NOT NULL AND barcode <> '';
