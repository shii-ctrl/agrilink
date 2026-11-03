ALTER TABLE orders
  ADD COLUMN farmer_settlement_eligible BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE orders
  ALTER COLUMN farmer_settlement_eligible SET DEFAULT TRUE;

CREATE TABLE farmer_earnings (
  id VARCHAR(36) PRIMARY KEY,
  order_id VARCHAR(36) NOT NULL,
  inventory_id VARCHAR(36) NOT NULL,
  receiving_id VARCHAR(36) NOT NULL,
  farmer_id VARCHAR(36) NOT NULL,
  product_id VARCHAR(36) NOT NULL,
  classification_id INT NOT NULL,
  selling_unit ENUM('kg','piece','bundle','pack','tray','sack') NOT NULL,
  quantity DECIMAL(12,2) NOT NULL,
  price_per_unit DECIMAL(12,2) NOT NULL,
  gross_amount DECIMAL(12,2) NOT NULL,
  service_fee DECIMAL(12,2) NOT NULL,
  ipon_contribution DECIMAL(12,2) NOT NULL,
  net_amount DECIMAL(12,2) NOT NULL,
  status ENUM('pending_payment','available','paid') NOT NULL DEFAULT 'pending_payment',
  payout_id VARCHAR(36) NULL,
  ipon_release_id VARCHAR(36) NULL,
  eligible_at DATETIME NULL,
  paid_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY farmer_earnings_order_inventory_unique (order_id, inventory_id),
  INDEX farmer_earnings_farmer_status_idx (farmer_id, status, created_at),
  INDEX farmer_earnings_receiving_idx (receiving_id, status),
  INDEX farmer_earnings_ipon_idx (farmer_id, ipon_release_id, status)
);

CREATE TABLE farmer_payouts (
  id VARCHAR(36) PRIMARY KEY,
  payout_number VARCHAR(40) NOT NULL,
  farmer_id VARCHAR(36) NOT NULL,
  receiving_id VARCHAR(36) NOT NULL,
  gross_amount DECIMAL(12,2) NOT NULL,
  service_fee DECIMAL(12,2) NOT NULL,
  ipon_contribution DECIMAL(12,2) NOT NULL,
  net_amount DECIMAL(12,2) NOT NULL,
  method ENUM('cash') NOT NULL DEFAULT 'cash',
  released_by_id VARCHAR(36) NOT NULL,
  released_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY farmer_payouts_number_unique (payout_number),
  INDEX farmer_payouts_farmer_idx (farmer_id, released_at),
  INDEX farmer_payouts_receiving_idx (receiving_id, released_at)
);

CREATE TABLE farmer_ipon_releases (
  id VARCHAR(36) PRIMARY KEY,
  release_number VARCHAR(40) NOT NULL,
  farmer_id VARCHAR(36) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  method ENUM('cash') NOT NULL DEFAULT 'cash',
  released_by_id VARCHAR(36) NOT NULL,
  released_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY farmer_ipon_releases_number_unique (release_number),
  INDEX farmer_ipon_releases_farmer_idx (farmer_id, released_at)
);
