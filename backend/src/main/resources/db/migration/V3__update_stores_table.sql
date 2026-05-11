-- ============================================================
-- V3 : Mise à jour de la table stores
--      - Ajout du champ phone
--      - Passage à un ID auto-incrémenté (SERIAL) pour le multi-tenant
-- ============================================================

-- Ajout de la colonne phone si elle n'existe pas déjà
ALTER TABLE stores ADD COLUMN IF NOT EXISTS phone VARCHAR(20);

-- On change l'ID en séquence auto pour permettre plusieurs quincailleries
-- On crée une séquence et on met à jour le default
CREATE SEQUENCE IF NOT EXISTS stores_id_seq START WITH 3 INCREMENT BY 1;
ALTER TABLE stores ALTER COLUMN id SET DEFAULT nextval('stores_id_seq');
SELECT setval('stores_id_seq', COALESCE((SELECT MAX(id) FROM stores), 2), true);
