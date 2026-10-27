-- Rider accounts are created by Management only. Delivery stays enabled by
-- default so existing deployments retain their current checkout behavior.
INSERT IGNORE INTO roles (name) VALUES ('Rider');

ALTER TABLE delivery_settings
  ADD COLUMN IF NOT EXISTS delivery_enabled BOOLEAN NOT NULL DEFAULT TRUE AFTER flat_fee;

UPDATE delivery_settings
SET delivery_enabled = TRUE
WHERE id = 1 AND delivery_enabled IS NULL;
