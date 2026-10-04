-- ============================================================
-- V9 : Augmentation de la précision de min_quantity à NUMERIC(12, 4)
-- ============================================================
-- Permet de stocker des seuils d'alerte précis lorsque l'utilisateur
-- saisit un seuil en pièces pour un carton/boîte (ex: 20 pièces / 100 = 0.2000).

ALTER TABLE product_stocks
    ALTER COLUMN min_quantity TYPE NUMERIC(12, 4);
