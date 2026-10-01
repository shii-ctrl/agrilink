-- Persist authentication throttles so they remain effective across server restarts and instances.
CREATE TABLE IF NOT EXISTS security_rate_limits (
  scope VARCHAR(64) NOT NULL,
  key_hash VARCHAR(64) NOT NULL,
  attempts INT NOT NULL,
  window_started_at DATETIME NOT NULL,
  locked_until DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (scope, key_hash),
  KEY security_rate_limits_window_idx (window_started_at)
);
