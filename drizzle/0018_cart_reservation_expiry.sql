-- A buyer cart reserves stock for ten minutes only. Expired cart lines are
-- released by the server before the cart is shown, changed, or checked out.
ALTER TABLE cart_items
  ADD COLUMN IF NOT EXISTS reservation_expires_at DATETIME NULL AFTER quantity_kg;

UPDATE cart_items
SET reservation_expires_at = DATE_ADD(COALESCE(updated_at, created_at, NOW()), INTERVAL 10 MINUTE)
WHERE reservation_expires_at IS NULL;

ALTER TABLE cart_items
  MODIFY COLUMN reservation_expires_at DATETIME NOT NULL;

CREATE INDEX IF NOT EXISTS cart_items_reservation_expiry_idx
  ON cart_items (reservation_expires_at);
