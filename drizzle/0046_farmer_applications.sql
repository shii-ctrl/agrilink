CREATE TABLE IF NOT EXISTS farmer_applications (
  user_id VARCHAR(36) NOT NULL PRIMARY KEY,
  farming_location VARCHAR(500) NOT NULL,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  rejection_reason TEXT NULL,
  reviewed_by_id VARCHAR(36) NULL,
  reviewed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY farmer_applications_status_idx (status, created_at),
  CONSTRAINT fk_farmer_application_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Existing Farmer accounts retain their current active/inactive state and access.
INSERT IGNORE INTO farmer_applications (user_id, farming_location, status, reviewed_at, created_at)
SELECT DISTINCT u.id, 'Not provided (existing Farmer account)', 'approved', UTC_TIMESTAMP(), u.created_at
FROM users u
JOIN user_roles ur ON ur.user_id = u.id
JOIN roles r ON r.id = ur.role_id
WHERE r.name = 'Farmer';
