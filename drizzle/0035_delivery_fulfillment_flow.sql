ALTER TABLE orders
  ADD COLUMN fulfillment_method ENUM('pickup', 'delivery') NOT NULL DEFAULT 'pickup' AFTER status,
  ADD COLUMN fulfillment_status ENUM('pending', 'confirmed', 'preparing', 'ready_for_pickup', 'ready_for_dispatch', 'rider_assigned', 'out_for_delivery', 'picked_up', 'delivered', 'cancelled', 'rejected') NOT NULL DEFAULT 'pending' AFTER fulfillment_method,
  ADD COLUMN recipient_name VARCHAR(160) NULL AFTER pickup_note,
  ADD COLUMN delivery_address TEXT NULL AFTER recipient_name,
  ADD COLUMN preferred_schedule VARCHAR(255) NULL AFTER delivery_address,
  ADD COLUMN delivery_instructions TEXT NULL AFTER preferred_schedule,
  ADD COLUMN assigned_rider_id VARCHAR(36) NULL AFTER delivery_instructions,
  ADD COLUMN fulfilled_at DATETIME NULL AFTER sold_at,
  ADD INDEX orders_fulfillment_idx (fulfillment_method, fulfillment_status),
  ADD INDEX orders_assigned_rider_idx (assigned_rider_id, fulfillment_status);

UPDATE orders
SET fulfillment_method = CASE WHEN pickup_note LIKE 'Delivery:%' THEN 'delivery' ELSE 'pickup' END,
    fulfillment_status = CASE status
      WHEN 'confirmed' THEN 'confirmed'
      WHEN 'sold' THEN CASE WHEN pickup_note LIKE 'Delivery:%' THEN 'delivered' ELSE 'picked_up' END
      WHEN 'cancelled' THEN 'cancelled'
      WHEN 'rejected' THEN 'rejected'
      ELSE 'pending'
    END,
    fulfilled_at = CASE WHEN status = 'sold' THEN sold_at ELSE NULL END;

CREATE TABLE order_fulfillment_history (
  id VARCHAR(36) PRIMARY KEY,
  order_id VARCHAR(36) NOT NULL,
  status ENUM('pending', 'confirmed', 'preparing', 'ready_for_pickup', 'ready_for_dispatch', 'rider_assigned', 'out_for_delivery', 'picked_up', 'delivered', 'cancelled', 'rejected') NOT NULL,
  changed_by_id VARCHAR(36) NULL,
  note TEXT NULL,
  changed_at DATETIME NOT NULL,
  INDEX order_fulfillment_history_order_idx (order_id, changed_at)
);

INSERT INTO order_fulfillment_history (id, order_id, status, changed_by_id, note, changed_at)
SELECT UUID(), id, fulfillment_status, NULL, 'Opening fulfillment status migrated from the existing order.', COALESCE(fulfilled_at, confirmed_at, created_at)
FROM orders;
