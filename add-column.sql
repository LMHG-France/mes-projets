-- Add expected_delivery_date column to orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'expected_delivery_date'
  ) THEN
    ALTER TABLE orders ADD COLUMN expected_delivery_date date;
  END IF;
END $$;
