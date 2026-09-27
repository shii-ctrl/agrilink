-- Keep catalog names unique and make farmer-to-consultant guidance assignments explicit.
-- Existing guidance conversations are retained and used to create the first assignment per Farmer.

ALTER TABLE products ADD UNIQUE KEY products_name_unique (name);

CREATE TABLE IF NOT EXISTS farmer_consultant_assignments (
  farmer_id VARCHAR(36) PRIMARY KEY,
  consultant_id VARCHAR(36) NOT NULL,
  assigned_by_id VARCHAR(36) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY farmer_consultant_consultant_idx (consultant_id),
  CONSTRAINT fk_farmer_consultant_farmer FOREIGN KEY (farmer_id) REFERENCES users(id),
  CONSTRAINT fk_farmer_consultant_consultant FOREIGN KEY (consultant_id) REFERENCES users(id),
  CONSTRAINT fk_farmer_consultant_assigned_by FOREIGN KEY (assigned_by_id) REFERENCES users(id)
);

INSERT IGNORE INTO farmer_consultant_assignments (farmer_id, consultant_id)
SELECT farmer_id, MIN(consultant_id)
FROM guidance_messages
GROUP BY farmer_id;
