-- Add the operational datasets used by AgriLink's existing pages.
-- This migration is safe to run more than once against agrilink_local.

CREATE TABLE IF NOT EXISTS receiving_records (
  id VARCHAR(36) PRIMARY KEY,
  farmer_id VARCHAR(36) NOT NULL,
  recorded_by_id VARCHAR(36) NOT NULL,
  product_id VARCHAR(36) NOT NULL,
  total_kg DECIMAL(12,2) NOT NULL,
  received_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_receiving_farmer FOREIGN KEY (farmer_id) REFERENCES users(id),
  CONSTRAINT fk_receiving_recorder FOREIGN KEY (recorded_by_id) REFERENCES users(id),
  CONSTRAINT fk_receiving_product FOREIGN KEY (product_id) REFERENCES products(id)
);

-- production_records is created in 0002_production_records.sql.

CREATE TABLE IF NOT EXISTS receiving_classifications (
  id VARCHAR(36) PRIMARY KEY,
  receiving_id VARCHAR(36) NOT NULL,
  classification_id INT NOT NULL,
  quantity_kg DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_receiving_classification_receiving FOREIGN KEY (receiving_id) REFERENCES receiving_records(id),
  CONSTRAINT fk_receiving_classification_type FOREIGN KEY (classification_id) REFERENCES classifications(id),
  UNIQUE KEY receiving_classification_unique (receiving_id, classification_id)
);

CREATE TABLE IF NOT EXISTS community_messages (
  id VARCHAR(36) PRIMARY KEY,
  author_id VARCHAR(36) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_community_author FOREIGN KEY (author_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS guidance_messages (
  id VARCHAR(36) PRIMARY KEY,
  farmer_id VARCHAR(36) NOT NULL,
  consultant_id VARCHAR(36) NOT NULL,
  author_id VARCHAR(36) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_guidance_farmer FOREIGN KEY (farmer_id) REFERENCES users(id),
  CONSTRAINT fk_guidance_consultant FOREIGN KEY (consultant_id) REFERENCES users(id),
  CONSTRAINT fk_guidance_author FOREIGN KEY (author_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(36) PRIMARY KEY,
  actor_id VARCHAR(36) NULL,
  action VARCHAR(120) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id VARCHAR(36) NULL,
  details JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id VARCHAR(36) PRIMARY KEY,
  inventory_id VARCHAR(36) NOT NULL,
  movement_type ENUM('receiving','reservation','release','sale','adjustment','return') NOT NULL,
  available_change_kg DECIMAL(12,2) NOT NULL DEFAULT 0,
  reserved_change_kg DECIMAL(12,2) NOT NULL DEFAULT 0,
  reference_type VARCHAR(50) NULL,
  reference_id VARCHAR(36) NULL,
  recorded_by_id VARCHAR(36) NULL,
  note TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_inventory_movement_inventory FOREIGN KEY (inventory_id) REFERENCES inventory(id),
  CONSTRAINT fk_inventory_movement_recorder FOREIGN KEY (recorded_by_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS order_status_history (
  id VARCHAR(36) PRIMARY KEY,
  order_id VARCHAR(36) NOT NULL,
  status ENUM('pending','confirmed','sold','cancelled','rejected') NOT NULL,
  changed_by_id VARCHAR(36) NULL,
  note TEXT NULL,
  changed_at DATETIME NOT NULL,
  CONSTRAINT fk_order_history_order FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT fk_order_history_user FOREIGN KEY (changed_by_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_auth_session_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS saved_drafts (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  name VARCHAR(160) NOT NULL,
  draft_type VARCHAR(80) NOT NULL,
  content JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_saved_drafts_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX receiving_records_farmer_idx ON receiving_records (farmer_id, received_at);
CREATE INDEX receiving_classifications_receiving_idx ON receiving_classifications (receiving_id);
CREATE INDEX community_messages_author_idx ON community_messages (author_id, created_at);
CREATE INDEX guidance_messages_farmer_idx ON guidance_messages (farmer_id, created_at);
CREATE INDEX audit_logs_entity_idx ON audit_logs (entity_type, entity_id);
CREATE INDEX inventory_movements_inventory_idx ON inventory_movements (inventory_id, created_at);
CREATE INDEX order_status_history_order_idx ON order_status_history (order_id, changed_at);
CREATE INDEX auth_sessions_user_idx ON auth_sessions (user_id);
CREATE INDEX password_reset_tokens_user_idx ON password_reset_tokens (user_id);
CREATE INDEX saved_drafts_user_idx ON saved_drafts (user_id, draft_type);

-- Roles and accounts. Password values are deliberately unusable until real authentication is built.
INSERT IGNORE INTO roles (name) VALUES ('Management'), ('Marketer'), ('Accounting'), ('Buyer'), ('Farmer'), ('Farm Consultant');
INSERT IGNORE INTO users (id, username, email, password_hash, display_name, contact) VALUES
  ('00000000-0000-4000-8000-000000000001', 'management.demo', 'management@agrilink.local', 'AUTH_NOT_CONFIGURED', 'Maria Santos', '0917-555-0101'),
  ('00000000-0000-4000-8000-000000000002', 'marketer.demo', 'marketer@agrilink.local', 'AUTH_NOT_CONFIGURED', 'Ramon Reyes', '0917-555-0102'),
  ('00000000-0000-4000-8000-000000000003', 'accounting.demo', 'accounting@agrilink.local', 'AUTH_NOT_CONFIGURED', 'Liza Cruz', '0917-555-0103'),
  ('00000000-0000-4000-8000-000000000004', 'buyer.demo', 'buyer@agrilink.local', 'AUTH_NOT_CONFIGURED', 'Carlo Mendoza', '0917-555-0104'),
  ('00000000-0000-4000-8000-000000000005', 'farmer.demo', 'farmer@agrilink.local', 'AUTH_NOT_CONFIGURED', 'Juan Dela Cruz', '0917-555-0105'),
  ('00000000-0000-4000-8000-000000000006', 'consultant.demo', 'consultant@agrilink.local', 'AUTH_NOT_CONFIGURED', 'Ana Garcia', '0917-555-0106');
INSERT IGNORE INTO user_roles (user_id, role_id)
SELECT '00000000-0000-4000-8000-000000000001', id FROM roles WHERE name = 'Management';
INSERT IGNORE INTO user_roles (user_id, role_id)
SELECT '00000000-0000-4000-8000-000000000002', id FROM roles WHERE name = 'Marketer';
INSERT IGNORE INTO user_roles (user_id, role_id)
SELECT '00000000-0000-4000-8000-000000000003', id FROM roles WHERE name = 'Accounting';
INSERT IGNORE INTO user_roles (user_id, role_id)
SELECT '00000000-0000-4000-8000-000000000004', id FROM roles WHERE name = 'Buyer';
INSERT IGNORE INTO user_roles (user_id, role_id)
SELECT '00000000-0000-4000-8000-000000000005', id FROM roles WHERE name = 'Farmer';
INSERT IGNORE INTO user_roles (user_id, role_id)
SELECT '00000000-0000-4000-8000-000000000006', id FROM roles WHERE name = 'Farm Consultant';
INSERT IGNORE INTO classifications (name) VALUES ('Good'), ('Semi'), ('Reject');

INSERT IGNORE INTO products (id, name, crop_type, description, active) VALUES
  ('10000000-0000-4000-8000-000000000001', 'Tomato', 'Fruit Vegetable', 'Locally grown tomato from PROCY farmer members.', TRUE),
  ('10000000-0000-4000-8000-000000000002', 'Cabbage', 'Leafy Vegetable', 'Fresh cabbage supplied through PROCY.', TRUE),
  ('10000000-0000-4000-8000-000000000003', 'Eggplant', 'Fruit Vegetable', 'Fresh eggplant supplied through PROCY.', TRUE),
  ('10000000-0000-4000-8000-000000000004', 'Carrot', 'Root Vegetable', 'Fresh carrots supplied through PROCY.', TRUE);

INSERT IGNORE INTO receiving_records (id, farmer_id, recorded_by_id, product_id, total_kg, received_at) VALUES
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 220.00, '2026-09-18 09:00:00'),
  ('20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 160.00, '2026-09-19 10:00:00');
INSERT IGNORE INTO receiving_classifications (id, receiving_id, classification_id, quantity_kg)
SELECT '21000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', id, 140.00 FROM classifications WHERE name = 'Good';
INSERT IGNORE INTO receiving_classifications (id, receiving_id, classification_id, quantity_kg)
SELECT '21000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', id, 60.00 FROM classifications WHERE name = 'Semi';
INSERT IGNORE INTO receiving_classifications (id, receiving_id, classification_id, quantity_kg)
SELECT '21000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', id, 20.00 FROM classifications WHERE name = 'Reject';
INSERT IGNORE INTO receiving_classifications (id, receiving_id, classification_id, quantity_kg)
SELECT '21000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000002', id, 100.00 FROM classifications WHERE name = 'Good';
INSERT IGNORE INTO receiving_classifications (id, receiving_id, classification_id, quantity_kg)
SELECT '21000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000002', id, 45.00 FROM classifications WHERE name = 'Semi';
INSERT IGNORE INTO receiving_classifications (id, receiving_id, classification_id, quantity_kg)
SELECT '21000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000002', id, 15.00 FROM classifications WHERE name = 'Reject';

INSERT IGNORE INTO inventory (id, product_id, classification_id, quantity_kg, reserved_kg)
SELECT '30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', id, 125.00, 5.00 FROM classifications WHERE name = 'Good';
INSERT IGNORE INTO inventory (id, product_id, classification_id, quantity_kg, reserved_kg)
SELECT '30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', id, 60.00, 0.00 FROM classifications WHERE name = 'Semi';
INSERT IGNORE INTO inventory (id, product_id, classification_id, quantity_kg, reserved_kg)
SELECT '30000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', id, 20.00, 0.00 FROM classifications WHERE name = 'Reject';
INSERT IGNORE INTO inventory (id, product_id, classification_id, quantity_kg, reserved_kg)
SELECT '30000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', id, 100.00, 0.00 FROM classifications WHERE name = 'Good';
INSERT IGNORE INTO inventory (id, product_id, classification_id, quantity_kg, reserved_kg)
SELECT '30000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000002', id, 45.00, 0.00 FROM classifications WHERE name = 'Semi';
INSERT IGNORE INTO inventory (id, product_id, classification_id, quantity_kg, reserved_kg)
SELECT '30000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000002', id, 15.00, 0.00 FROM classifications WHERE name = 'Reject';
INSERT IGNORE INTO inventory (id, product_id, classification_id, quantity_kg, reserved_kg)
SELECT '30000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000003', id, 80.00, 0.00 FROM classifications WHERE name = 'Good';
INSERT IGNORE INTO inventory (id, product_id, classification_id, quantity_kg, reserved_kg)
SELECT '30000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000004', id, 70.00, 0.00 FROM classifications WHERE name = 'Good';

INSERT IGNORE INTO marketplace_listings (id, inventory_id, price_per_kg, status) VALUES
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 78.00, 'published'),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', 55.00, 'published'),
  ('40000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000003', 30.00, 'published'),
  ('40000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000004', 60.00, 'published'),
  ('40000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000005', 40.00, 'published'),
  ('40000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000007', 70.00, 'published'),
  ('40000000-0000-4000-8000-000000000007', '30000000-0000-4000-8000-000000000008', 85.00, 'published');

INSERT IGNORE INTO orders (id, order_number, buyer_id, status, contact, pickup_note, total_amount, confirmed_at, sold_at) VALUES
  ('50000000-0000-4000-8000-000000000001', 'ORD-2026-001', '00000000-0000-4000-8000-000000000004', 'sold', '0917-555-0104', 'Pickup completed at the PROCY collection point.', 1170.00, '2026-09-18 11:00:00', '2026-09-18 15:00:00'),
  ('50000000-0000-4000-8000-000000000002', 'ORD-2026-002', '00000000-0000-4000-8000-000000000004', 'pending', '0917-555-0104', 'Buyer will coordinate pickup with PROCY.', 390.00, NULL, NULL);
INSERT IGNORE INTO order_items (id, order_id, listing_id, quantity_kg, price_per_kg) VALUES
  ('51000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 15.00, 78.00),
  ('51000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000001', 5.00, 78.00);
INSERT IGNORE INTO order_status_history (id, order_id, status, changed_by_id, note, changed_at) VALUES
  ('52000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 'pending', '00000000-0000-4000-8000-000000000004', 'Buyer submitted the order.', '2026-09-18 10:30:00'),
  ('52000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000001', 'confirmed', '00000000-0000-4000-8000-000000000002', 'Marketer confirmed available stock.', '2026-09-18 11:00:00'),
  ('52000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000001', 'sold', '00000000-0000-4000-8000-000000000002', 'Pickup was completed.', '2026-09-18 15:00:00'),
  ('52000000-0000-4000-8000-000000000004', '50000000-0000-4000-8000-000000000002', 'pending', '00000000-0000-4000-8000-000000000004', 'Buyer submitted the order.', '2026-09-20 08:30:00');
INSERT IGNORE INTO payments (id, payment_number, order_id, method, amount, recorded_by_id, paid_at) VALUES
  ('60000000-0000-4000-8000-000000000001', 'PAY-2026-001', '50000000-0000-4000-8000-000000000001', 'cash', 1170.00, '00000000-0000-4000-8000-000000000003', '2026-09-18 15:30:00');

INSERT IGNORE INTO inventory_movements (id, inventory_id, movement_type, available_change_kg, reserved_change_kg, reference_type, reference_id, recorded_by_id, note) VALUES
  ('61000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'receiving', 140.00, 0.00, 'receiving_record', '20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'Tomato Good classification received.'),
  ('61000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', 'sale', -15.00, 0.00, 'order', '50000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'Sold Tomato Good quantity.'),
  ('61000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000001', 'reservation', 0.00, 5.00, 'order', '50000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', 'Reserved Tomato Good for pending order.');

INSERT IGNORE INTO daily_prices (id, listing_id, price, price_date, published, created_by_id) VALUES
  ('70000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 76.00, '2026-09-16', TRUE, '00000000-0000-4000-8000-000000000002'),
  ('70000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000001', 77.00, '2026-09-17', TRUE, '00000000-0000-4000-8000-000000000002'),
  ('70000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000001', 78.00, '2026-09-18', TRUE, '00000000-0000-4000-8000-000000000002'),
  ('70000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000001', 79.00, '2026-09-19', TRUE, '00000000-0000-4000-8000-000000000002'),
  ('70000000-0000-4000-8000-000000000005', '40000000-0000-4000-8000-000000000001', 78.00, '2026-09-20', TRUE, '00000000-0000-4000-8000-000000000002'),
  ('70000000-0000-4000-8000-000000000006', '40000000-0000-4000-8000-000000000002', 52.00, '2026-09-16', TRUE, '00000000-0000-4000-8000-000000000002'),
  ('70000000-0000-4000-8000-000000000007', '40000000-0000-4000-8000-000000000002', 54.00, '2026-09-17', TRUE, '00000000-0000-4000-8000-000000000002'),
  ('70000000-0000-4000-8000-000000000008', '40000000-0000-4000-8000-000000000002', 55.00, '2026-09-18', TRUE, '00000000-0000-4000-8000-000000000002'),
  ('70000000-0000-4000-8000-000000000009', '40000000-0000-4000-8000-000000000002', 55.00, '2026-09-19', TRUE, '00000000-0000-4000-8000-000000000002'),
  ('70000000-0000-4000-8000-000000000010', '40000000-0000-4000-8000-000000000002', 55.00, '2026-09-20', TRUE, '00000000-0000-4000-8000-000000000002'),
  ('70000000-0000-4000-8000-000000000011', '40000000-0000-4000-8000-000000000003', 28.00, '2026-09-16', TRUE, '00000000-0000-4000-8000-000000000002'),
  ('70000000-0000-4000-8000-000000000012', '40000000-0000-4000-8000-000000000003', 29.00, '2026-09-17', TRUE, '00000000-0000-4000-8000-000000000002'),
  ('70000000-0000-4000-8000-000000000013', '40000000-0000-4000-8000-000000000003', 30.00, '2026-09-18', TRUE, '00000000-0000-4000-8000-000000000002'),
  ('70000000-0000-4000-8000-000000000014', '40000000-0000-4000-8000-000000000003', 30.00, '2026-09-19', TRUE, '00000000-0000-4000-8000-000000000002'),
  ('70000000-0000-4000-8000-000000000015', '40000000-0000-4000-8000-000000000003', 30.00, '2026-09-20', TRUE, '00000000-0000-4000-8000-000000000002');

INSERT IGNORE INTO community_messages (id, author_id, message) VALUES
  ('80000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000006', 'Please monitor tomato plants regularly and report any production concerns through your assigned crop guidance conversation.'),
  ('80000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000005', 'Tomato harvest delivery was completed and recorded by PROCY.'),
  ('80000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', 'Daily prices have been reviewed for the current demonstration period.');
INSERT IGNORE INTO guidance_messages (id, farmer_id, consultant_id, author_id, message) VALUES
  ('81000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000006', 'Monitor tomato leaf condition this week and send an update if symptoms change.');
INSERT IGNORE INTO notifications (id, user_id, title, message, target) VALUES
  ('82000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000004', 'Order awaiting confirmation', 'ORD-2026-002 has been received by PROCY.', '/buyer/orders'),
  ('82000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003', 'Sale payment ready', 'ORD-2026-001 has been marked sold and its payment was recorded for this demo.', '/accounting/payments'),
  ('82000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000005', 'New crop guidance', 'Your consultant has sent a crop-guidance message.', '/farmer/guidance');
INSERT IGNORE INTO audit_logs (id, actor_id, action, entity_type, entity_id, details) VALUES
  ('83000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'RECEIVED_DELIVERY', 'receiving_record', '20000000-0000-4000-8000-000000000001', JSON_OBJECT('totalKg', 220.00)),
  ('83000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003', 'RECORDED_PAYMENT', 'payment', '60000000-0000-4000-8000-000000000001', JSON_OBJECT('amount', 1170.00));
