-- Move stock holds from carts/Pending orders to Marketer confirmation.
-- The migration runner executes this data change and its marker in one transaction.
-- Reconstruct only legacy Pending allocations without any movement history.
INSERT INTO inventory_movements
  (id, inventory_id, movement_type, available_change_kg, reserved_change_kg,
   reference_type, reference_id, recorded_by_id, note)
SELECT UUID(), l.inventory_id, 'reservation', 0, oi.quantity_kg,
       'order', o.id, o.buyer_id, 'Legacy Pending allocation before confirmation-only stock.'
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
JOIN marketplace_listings l ON l.id = oi.listing_id
WHERE o.status = 'pending'
  AND NOT EXISTS (
    SELECT 1 FROM inventory_movements m
    WHERE m.reference_type = 'order' AND m.reference_id = o.id
  );

CREATE TEMPORARY TABLE confirmation_stock_releases (
  inventory_id VARCHAR(36) NOT NULL,
  reference_type VARCHAR(50) NOT NULL,
  reference_id VARCHAR(36) NOT NULL,
  quantity DECIMAL(12,2) NOT NULL
);
INSERT INTO confirmation_stock_releases
SELECT m.inventory_id, m.reference_type, m.reference_id, SUM(m.reserved_change_kg)
FROM inventory_movements m
LEFT JOIN orders o ON m.reference_type = 'order' AND o.id = m.reference_id
WHERE m.reference_type = 'cart' OR (m.reference_type = 'order' AND o.status = 'pending')
GROUP BY m.inventory_id, m.reference_type, m.reference_id
HAVING SUM(m.reserved_change_kg) > 0;

-- Fail and roll back if the historical ledger does not match reserved inventory.
CREATE TEMPORARY TABLE confirmation_stock_check (
  remaining_reserved DECIMAL(12,2) NOT NULL CHECK (remaining_reserved >= 0)
);
INSERT INTO confirmation_stock_check
SELECT i.reserved_kg - r.quantity
FROM inventory i
JOIN (
  SELECT inventory_id, SUM(quantity) quantity
  FROM confirmation_stock_releases GROUP BY inventory_id
) r ON r.inventory_id = i.id;

UPDATE inventory i
JOIN (
  SELECT inventory_id, SUM(quantity) quantity
  FROM confirmation_stock_releases GROUP BY inventory_id
) r ON r.inventory_id = i.id
SET i.reserved_kg = i.reserved_kg - r.quantity;

INSERT INTO inventory_movements
  (id, inventory_id, movement_type, available_change_kg, reserved_change_kg,
   reference_type, reference_id, note)
SELECT UUID(), inventory_id, 'release', 0, -quantity,
       reference_type, reference_id, 'Released for confirmation-only stock allocation.'
FROM confirmation_stock_releases;

DROP TEMPORARY TABLE confirmation_stock_check;
DROP TEMPORARY TABLE confirmation_stock_releases;
