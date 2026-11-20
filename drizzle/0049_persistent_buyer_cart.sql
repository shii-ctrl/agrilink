-- Retain the legacy column for compatibility, but cart items no longer expire.
ALTER TABLE cart_items MODIFY COLUMN reservation_expires_at DATETIME NULL DEFAULT NULL;
