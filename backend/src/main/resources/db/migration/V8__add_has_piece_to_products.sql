-- ============================================================
-- V8 : Ajout de l'option de vente "par pièce" sur les produits BOX
-- ============================================================
-- Permet de marquer un produit (Boîte / Carton) comme pouvant être
-- vendu à l'unité (pièce par pièce), en plus ou indépendamment
-- de la vente par lot (has_lot).

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS has_piece BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS piece_price NUMERIC(12, 2) NULL;

COMMENT ON COLUMN products.has_piece IS
    'Indique si le produit (archetype BOX) peut être vendu à l''unité (pièce par pièce). Cumulable avec has_lot.';

COMMENT ON COLUMN products.piece_price IS
    'Prix de vente à la pièce, utilisé lorsque has_piece est actif.';
