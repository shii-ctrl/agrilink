-- Preserve historical payment methods while allowing new COD records. New payment submissions
-- are restricted to cash or cash_on_delivery by the application validator.
ALTER TABLE payments
  MODIFY COLUMN method ENUM('cash', 'cash_on_delivery', 'bank_transfer', 'manual_reference') NOT NULL;
