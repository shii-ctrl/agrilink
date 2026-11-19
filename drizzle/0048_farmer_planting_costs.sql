CREATE TABLE IF NOT EXISTS farmer_plantings (
  id VARCHAR(36) PRIMARY KEY,
  farmer_id VARCHAR(36) NOT NULL,
  name VARCHAR(160) NOT NULL,
  crop_name VARCHAR(160) NOT NULL,
  planted_on VARCHAR(10) NOT NULL,
  notes TEXT NOT NULL,
  product_id VARCHAR(36) NULL,
  status ENUM('active','finished') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX farmer_plantings_owner_idx (farmer_id,status),
  CONSTRAINT fk_planting_farmer FOREIGN KEY (farmer_id) REFERENCES users(id),
  CONSTRAINT fk_planting_product FOREIGN KEY (product_id) REFERENCES products(id)
);
CREATE TABLE IF NOT EXISTS farmer_planting_expenses (
  id VARCHAR(36) PRIMARY KEY,
  planting_id VARCHAR(36) NOT NULL,
  occurred_on VARCHAR(10) NOT NULL,
  category VARCHAR(40) NOT NULL,
  description VARCHAR(255) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  notes TEXT NOT NULL,
  deleted_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX farmer_planting_expenses_date_idx (planting_id,occurred_on),
  CONSTRAINT fk_planting_expense FOREIGN KEY (planting_id) REFERENCES farmer_plantings(id)
);
CREATE TABLE IF NOT EXISTS farmer_planting_deliveries (
  receiving_id VARCHAR(36) PRIMARY KEY,
  planting_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX farmer_planting_deliveries_planting_idx (planting_id),
  CONSTRAINT fk_planting_delivery FOREIGN KEY (planting_id) REFERENCES farmer_plantings(id),
  CONSTRAINT fk_planting_receiving FOREIGN KEY (receiving_id) REFERENCES receiving_records(id)
);
