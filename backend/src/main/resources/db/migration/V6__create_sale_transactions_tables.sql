-- V6__create_sale_transactions_tables.sql

CREATE TABLE sale_transactions (
    id UUID PRIMARY KEY,
    store_id UUID NOT NULL,
    user_id UUID NOT NULL,
    total_amount NUMERIC(12, 2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    amount_given NUMERIC(12, 2),
    change_amount NUMERIC(12, 2),
    status VARCHAR(50) NOT NULL,
    transaction_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_store FOREIGN KEY (store_id) REFERENCES stores(id),
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE sale_items (
    id UUID PRIMARY KEY,
    transaction_id UUID NOT NULL,
    product_id UUID NOT NULL,
    quantity NUMERIC(12, 4) NOT NULL,
    sale_type VARCHAR(50) NOT NULL,
    unit_price NUMERIC(12, 2) NOT NULL,
    total_price NUMERIC(12, 2) NOT NULL,
    base_stock_deduction NUMERIC(12, 6) NOT NULL,
    CONSTRAINT fk_transaction FOREIGN KEY (transaction_id) REFERENCES sale_transactions(id) ON DELETE CASCADE,
    CONSTRAINT fk_product FOREIGN KEY (product_id) REFERENCES products(id)
);
