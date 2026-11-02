CREATE TABLE daily_price_alerts (
  id VARCHAR(36) PRIMARY KEY,
  buyer_id VARCHAR(36) NOT NULL,
  listing_id VARCHAR(36) NOT NULL,
  target_price DECIMAL(12,2) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  last_notified_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY daily_price_alerts_buyer_listing_unique (buyer_id, listing_id),
  INDEX daily_price_alerts_listing_active_idx (listing_id, active)
);
