-- Repair production databases where the original CREATE TABLE IF NOT EXISTS
-- encountered an older partial security_rate_limits table.
ALTER TABLE security_rate_limits
  ADD COLUMN IF NOT EXISTS locked_until DATETIME NULL AFTER window_started_at;
