-- ============================================================
-- V1 : Schema complet du module Inventaire (Multi-Boutique & UUID)
-- ============================================================

-- L'extension pgcrypto est optionnelle pour gen_random_uuid() sur PG13+, mais assure la compatibilité
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Boutiques (Stores)
-- On garde un INTEGER pour les boutiques car le frontend utilise les IDs 1 et 2 en dur.
CREATE TABLE IF NOT EXISTS stores (
    id INTEGER PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    address VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO stores (id, name) VALUES (1, 'Boutique Principale') ON CONFLICT DO NOTHING;
INSERT INTO stores (id, name) VALUES (2, 'Boutique Secondaire') ON CONFLICT DO NOTHING;

-- 2. Produits (Catalogue commun)
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    category VARCHAR(100),
    supplier VARCHAR(100),

    unit_archetype VARCHAR(20) NOT NULL,
    base_unit VARCHAR(50) NOT NULL,
    bulk_unit VARCHAR(50),
    conversion_factor NUMERIC(10, 4) NOT NULL DEFAULT 1,
    retail_step_quantity INTEGER NOT NULL DEFAULT 1,

    bulk_purchase_price NUMERIC(12, 2),
    purchase_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    bulk_price NUMERIC(12, 2),

    has_lot BOOLEAN NOT NULL DEFAULT FALSE,
    lot_price NUMERIC(12, 2),
    has_sub_unit BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 3. Stocks par boutique (Relation Produit <-> Boutique)
CREATE TABLE IF NOT EXISTS product_stocks (
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    quantity NUMERIC(12, 4) NOT NULL DEFAULT 0,
    min_quantity NUMERIC(10, 2) NOT NULL DEFAULT 0,
    PRIMARY KEY (product_id, store_id)
);

-- 4. Lots de produits (Tracabilité FIFO)
CREATE TABLE IF NOT EXISTS product_lots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    batch_number VARCHAR(100),
    quantity NUMERIC(12, 4) NOT NULL,
    purchase_price NUMERIC(12, 2),
    expiry_date DATE,
    date_added TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 5. Modèles de fractionnement (Packaging Options)
CREATE TABLE IF NOT EXISTS packaging_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    target_unit VARCHAR(50) NOT NULL,
    deduction_ratio NUMERIC(10, 6) NOT NULL,
    price NUMERIC(12, 2) NOT NULL
);

-- 6. Mouvements de stock
CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    lot_id UUID REFERENCES product_lots(id) ON DELETE SET NULL,
    type VARCHAR(10) NOT NULL, -- 'IN', 'OUT'
    quantity NUMERIC(12, 4) NOT NULL,
    unit VARCHAR(50),
    reason VARCHAR(100),
    user_id VARCHAR(50),
    details TEXT,
    date TIMESTAMP NOT NULL DEFAULT NOW()
);
