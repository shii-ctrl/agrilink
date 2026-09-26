-- Keep inventory separate for every Farmer so marketplace stock and Farmer views
-- can trace a classification back to the delivery owner.
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS farmer_id VARCHAR(36) NULL AFTER product_id;
-- The original compound index also supports the product foreign key, so retain
-- a single-column replacement before removing it.
ALTER TABLE inventory ADD INDEX IF NOT EXISTS inventory_product_idx (product_id);
ALTER TABLE inventory DROP INDEX IF EXISTS inventory_product_classification_unique;
ALTER TABLE inventory ADD UNIQUE KEY IF NOT EXISTS inventory_product_classification_farmer_unique (product_id, classification_id, farmer_id);
ALTER TABLE inventory ADD INDEX IF NOT EXISTS inventory_farmer_idx (farmer_id, product_id);
ALTER TABLE inventory ADD CONSTRAINT IF NOT EXISTS fk_inventory_farmer FOREIGN KEY (farmer_id) REFERENCES users(id);
