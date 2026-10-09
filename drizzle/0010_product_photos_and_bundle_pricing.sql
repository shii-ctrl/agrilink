-- Product photos are selected from the Marketer's device and stored as small image data URLs.
ALTER TABLE products MODIFY COLUMN image_url MEDIUMTEXT NULL;

-- Existing listings keep their current price as retail-only listings. New listings can add a
-- lower per-kilo bundle price that applies from the selected minimum quantity.
ALTER TABLE marketplace_listings
  ADD COLUMN IF NOT EXISTS retail_price_per_kg DECIMAL(12,2) NULL AFTER price_per_kg,
  ADD COLUMN IF NOT EXISTS bundle_price_per_kg DECIMAL(12,2) NULL AFTER retail_price_per_kg,
  ADD COLUMN IF NOT EXISTS bundle_minimum_kg DECIMAL(12,2) NULL AFTER bundle_price_per_kg;
