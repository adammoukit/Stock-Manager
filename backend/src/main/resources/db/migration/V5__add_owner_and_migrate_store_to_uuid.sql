-- ============================================================
-- V5 : Migration Multi-Boutique par Propriétaire & UUID
-- ============================================================

-- 1. S'assurer que l'extension uuid-ossp est là
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Ajout de owner_id à stores et products (nullable temporairement)
ALTER TABLE stores ADD COLUMN owner_id UUID REFERENCES users(id);
ALTER TABLE products ADD COLUMN owner_id UUID REFERENCES users(id);

-- 3. Attribuer un propriétaire par défaut aux données existantes (le premier admin trouvé)
DO $$
DECLARE
    default_owner_id UUID;
BEGIN
    SELECT id INTO default_owner_id FROM users WHERE role = 'ADMIN' LIMIT 1;
    
    -- Si pas d'admin, on prend n'importe quel utilisateur
    IF default_owner_id IS NULL THEN
        SELECT id INTO default_owner_id FROM users LIMIT 1;
    END IF;

    -- Mise à jour si un utilisateur a été trouvé
    IF default_owner_id IS NOT NULL THEN
        UPDATE stores SET owner_id = default_owner_id WHERE owner_id IS NULL;
        UPDATE products SET owner_id = default_owner_id WHERE owner_id IS NULL;
    END IF;
END $$;

-- 4. Rendre owner_id NOT NULL après l'attribution
-- Note: On ne le fait que si des données existent, sinon on laisse le soin aux futurs inserts
-- Mais par sécurité pour le schéma, on le rend obligatoire
ALTER TABLE stores ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE products ALTER COLUMN owner_id SET NOT NULL;

-- ============================================================
-- MIGRATION DES IDS DE BOUTIQUES VERS UUID
-- ============================================================

-- A. Ajouter une nouvelle colonne UUID temporaire dans stores
ALTER TABLE stores ADD COLUMN new_id UUID DEFAULT uuid_generate_v4();

-- B. Mettre à jour les tables de référence (Ajout colonne UUID temporaire)
ALTER TABLE product_stocks ADD COLUMN store_uuid UUID;
ALTER TABLE product_lots ADD COLUMN store_uuid UUID;
ALTER TABLE stock_movements ADD COLUMN store_uuid UUID;
ALTER TABLE users ADD COLUMN store_uuid UUID;

-- C. Remplir les colonnes store_uuid en faisant la jointure
UPDATE product_stocks ps SET store_uuid = s.new_id FROM stores s WHERE ps.store_id = s.id;
UPDATE product_lots pl SET store_uuid = s.new_id FROM stores s WHERE pl.store_id = s.id;
UPDATE stock_movements sm SET store_uuid = s.new_id FROM stores s WHERE sm.store_id = s.id;
UPDATE users u SET store_uuid = s.new_id FROM stores s WHERE u.store_id = s.id;

-- D. Supprimer les anciennes contraintes et colonnes
-- Suppression des clés étrangères d'abord
ALTER TABLE product_stocks DROP CONSTRAINT IF EXISTS product_stocks_store_id_fkey;
ALTER TABLE product_lots DROP CONSTRAINT IF EXISTS product_lots_store_id_fkey;
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_store_id_fkey;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_store_id_fkey;

-- Suppression des colonnes integer
ALTER TABLE product_stocks DROP COLUMN store_id;
ALTER TABLE product_lots DROP COLUMN store_id;
ALTER TABLE stock_movements DROP COLUMN store_id;
ALTER TABLE users DROP COLUMN store_id;

-- E. Finaliser la table stores (supprimer l'ancien ID et renommer le nouveau)
-- On doit d'abord supprimer la PK actuelle
ALTER TABLE stores DROP CONSTRAINT stores_pkey CASCADE;
ALTER TABLE stores DROP COLUMN id;
ALTER TABLE stores RENAME COLUMN new_id TO id;
ALTER TABLE stores ADD PRIMARY KEY (id);

-- F. Renommer les colonnes store_uuid en store_id dans les tables de référence
ALTER TABLE product_stocks RENAME COLUMN store_uuid TO store_id;
ALTER TABLE product_lots RENAME COLUMN store_uuid TO store_id;
ALTER TABLE stock_movements RENAME COLUMN store_uuid TO store_id;
ALTER TABLE users RENAME COLUMN store_uuid TO store_id;

-- G. Recréer les contraintes de clés étrangères
ALTER TABLE product_stocks ADD CONSTRAINT product_stocks_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;
ALTER TABLE product_lots ADD CONSTRAINT product_lots_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;
ALTER TABLE users ADD CONSTRAINT users_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id);

-- H. Recréer la clé primaire composite de product_stocks
ALTER TABLE product_stocks ADD PRIMARY KEY (product_id, store_id);

-- I. Nettoyage : On peut supprimer la séquence si elle existe (V3)
DROP SEQUENCE IF EXISTS stores_id_seq;
