-- Applies the production dataset to an existing agrilink_local database.
CREATE TABLE IF NOT EXISTS production_records (
  id VARCHAR(36) PRIMARY KEY,
  farmer_id VARCHAR(36) NOT NULL,
  product_id VARCHAR(36) NULL,
  crop_name VARCHAR(160) NOT NULL,
  planting_date DATETIME NOT NULL,
  expected_harvest_date DATETIME NOT NULL,
  harvested_quantity_kg DECIMAL(12,2) NULL,
  recorded_by_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_production_farmer FOREIGN KEY (farmer_id) REFERENCES users(id),
  CONSTRAINT fk_production_product FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT fk_production_recorder FOREIGN KEY (recorded_by_id) REFERENCES users(id)
);
CREATE INDEX production_records_farmer_idx ON production_records (farmer_id, planting_date);
INSERT IGNORE INTO production_records (id, farmer_id, product_id, crop_name, planting_date, expected_harvest_date, harvested_quantity_kg, recorded_by_id) VALUES
  ('20500000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', 'Tomato', '2026-06-10 00:00:00', '2026-09-15 00:00:00', 220.00, '00000000-0000-4000-8000-000000000001'),
  ('20500000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000002', 'Cabbage', '2026-07-01 00:00:00', '2026-10-05 00:00:00', NULL, '00000000-0000-4000-8000-000000000001');
