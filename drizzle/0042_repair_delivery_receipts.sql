ALTER TABLE delivery_attempts
  ADD COLUMN IF NOT EXISTS recipient_name VARCHAR(160) NULL,
  ADD COLUMN IF NOT EXISTS attempted_at DATETIME NULL;

UPDATE delivery_attempts AS attempt
LEFT JOIN orders AS buyer_order ON buyer_order.id = attempt.order_id
SET attempt.recipient_name = CASE
      WHEN attempt.outcome = 'delivered'
        AND NULLIF(TRIM(buyer_order.recipient_name), '') IS NOT NULL
        THEN buyer_order.recipient_name
      ELSE attempt.recipient_name
    END,
    attempt.attempted_at = COALESCE(
      attempt.attempted_at,
      buyer_order.fulfilled_at,
      buyer_order.updated_at,
      CURRENT_TIMESTAMP
    )
WHERE attempt.attempted_at IS NULL
   OR (
     attempt.outcome = 'delivered'
     AND NULLIF(TRIM(buyer_order.recipient_name), '') IS NOT NULL
     AND (
       attempt.recipient_name IS NULL
       OR LOWER(TRIM(attempt.recipient_name)) <> LOWER(TRIM(buyer_order.recipient_name))
     )
   );

ALTER TABLE delivery_attempts
  MODIFY COLUMN attempted_at DATETIME NOT NULL;
