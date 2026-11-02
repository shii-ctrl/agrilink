ALTER TABLE orders
  MODIFY COLUMN fulfillment_status ENUM('pending', 'confirmed', 'preparing', 'ready_for_pickup', 'ready_for_dispatch', 'rider_assigned', 'out_for_delivery', 'delivery_failed', 'rescheduled', 'picked_up', 'delivered', 'cancelled', 'rejected') NOT NULL DEFAULT 'pending',
  ADD COLUMN delivery_otp_code VARCHAR(6) NULL AFTER assigned_rider_id;

ALTER TABLE order_fulfillment_history
  MODIFY COLUMN status ENUM('pending', 'confirmed', 'preparing', 'ready_for_pickup', 'ready_for_dispatch', 'rider_assigned', 'out_for_delivery', 'delivery_failed', 'rescheduled', 'picked_up', 'delivered', 'cancelled', 'rejected') NOT NULL;

UPDATE orders
SET delivery_otp_code = LPAD(FLOOR(RAND() * 1000000), 6, '0')
WHERE assigned_rider_id IS NOT NULL
  AND fulfillment_status IN ('rider_assigned', 'out_for_delivery');

CREATE TABLE delivery_assignments (
  id VARCHAR(36) PRIMARY KEY,
  order_id VARCHAR(36) NOT NULL,
  rider_id VARCHAR(36) NOT NULL,
  assigned_by_id VARCHAR(36) NULL,
  reason TEXT NULL,
  assigned_at DATETIME NOT NULL,
  INDEX delivery_assignments_order_idx (order_id, assigned_at)
);

INSERT INTO delivery_assignments (id, order_id, rider_id, assigned_by_id, reason, assigned_at)
SELECT UUID(), id, assigned_rider_id, NULL, 'Opening assignment migrated from the existing order.', updated_at
FROM orders
WHERE assigned_rider_id IS NOT NULL;

CREATE TABLE delivery_attempts (
  id VARCHAR(36) PRIMARY KEY,
  order_id VARCHAR(36) NOT NULL,
  rider_id VARCHAR(36) NOT NULL,
  outcome ENUM('delivered', 'buyer_unavailable', 'wrong_address', 'refused', 'rescheduled') NOT NULL,
  reason_note TEXT NULL,
  recipient_name VARCHAR(160) NULL,
  proof_photo_url MEDIUMTEXT NULL,
  signature_url MEDIUMTEXT NULL,
  latitude DECIMAL(10,7) NULL,
  longitude DECIMAL(10,7) NULL,
  next_schedule VARCHAR(255) NULL,
  attempted_at DATETIME NOT NULL,
  INDEX delivery_attempts_order_idx (order_id, attempted_at)
);

CREATE TABLE cod_remittances (
  id VARCHAR(36) PRIMARY KEY,
  order_id VARCHAR(36) NOT NULL,
  rider_id VARCHAR(36) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  status ENUM('collected', 'submitted', 'verified', 'closed') NOT NULL DEFAULT 'collected',
  collected_at DATETIME NOT NULL,
  submitted_at DATETIME NULL,
  verified_at DATETIME NULL,
  verified_by_id VARCHAR(36) NULL,
  closed_at DATETIME NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY cod_remittances_order_unique (order_id),
  INDEX cod_remittances_status_idx (status, created_at),
  INDEX cod_remittances_rider_idx (rider_id, status)
);
