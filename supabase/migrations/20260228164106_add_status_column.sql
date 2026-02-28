/*
  # Add status column to orders table

  1. Changes
    - Add `status` column to `orders` table
      - Type: text (nullable)
      - Allowed values: 'Problème', 'En cours Relais', 'En cours Maison', 'Livré', 'Récupéré'
      - Default: NULL (no status displayed)

  2. Notes
    - Status is optional - NULL means no status banner will be displayed
    - Status colors are handled in the frontend:
      - 'Problème': Red
      - 'En cours Relais': Orange
      - 'En cours Maison': Orange
      - 'Livré': Green
      - 'Récupéré': Dark Green
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'status'
  ) THEN
    ALTER TABLE orders ADD COLUMN status text;
  END IF;
END $$;
