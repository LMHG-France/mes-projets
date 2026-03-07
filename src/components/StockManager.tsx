ALTER TABLE orders
ADD COLUMN IF NOT EXISTS hidden_in_stock BOOLEAN NOT NULL DEFAULT FALSE;

-- Vérification
SELECT column_name FROM information_schema.columns
WHERE table_name = 'orders' AND column_name = 'hidden_in_stock';