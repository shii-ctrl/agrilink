-- Persistent buyer carts and one listing per classified inventory group.
-- This migration contains schema only; it creates no users or business records.

CREATE TABLE IF NOT EXISTS carts (
  id VARCHAR(36) PRIMARY KEY,
  buyer_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY carts_buyer_unique (buyer_id)
);

CREATE TABLE IF NOT EXISTS cart_items (
  id VARCHAR(36) PRIMARY KEY,
  cart_id VARCHAR(36) NOT NULL,
  listing_id VARCHAR(36) NOT NULL,
  quantity_kg DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY cart_items_cart_listing_unique (cart_id, listing_id),
  KEY cart_items_cart_idx (cart_id)
);

CREATE UNIQUE INDEX listings_inventory_unique ON marketplace_listings (inventory_id);
