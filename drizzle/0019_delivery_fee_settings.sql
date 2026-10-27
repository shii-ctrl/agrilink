-- Management controls a single delivery fee. The saved amount is copied to an
-- order at checkout, so later changes never alter existing orders or receipts.
CREATE TABLE IF NOT EXISTS delivery_settings (
  id INT NOT NULL PRIMARY KEY,
  flat_fee DECIMAL(12,2) NOT NULL DEFAULT 59.00,
  updated_by_id VARCHAR(36) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO delivery_settings (id, flat_fee) VALUES (1, 59.00);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER pickup_note;
