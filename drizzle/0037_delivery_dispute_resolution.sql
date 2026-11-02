CREATE TABLE delivery_disputes (
  id VARCHAR(36) PRIMARY KEY,
  dispute_number VARCHAR(40) NOT NULL,
  order_id VARCHAR(36) NOT NULL,
  buyer_id VARCHAR(36) NOT NULL,
  category ENUM('missing_quantity', 'wrong_product', 'damaged_product', 'incorrect_price', 'order_not_received', 'other') NOT NULL,
  description TEXT NOT NULL,
  attachment_url MEDIUMTEXT NULL,
  status ENUM('submitted', 'under_review', 'waiting_response', 'approved', 'rejected', 'resolved') NOT NULL DEFAULT 'submitted',
  resolution ENUM('replace_product', 'partial_refund', 'full_refund', 'credit_next_order', 'no_action') NULL,
  resolution_note TEXT NULL,
  refund_amount DECIMAL(12,2) NULL,
  refund_status ENUM('not_required', 'pending', 'processed') NOT NULL DEFAULT 'not_required',
  decided_by_id VARCHAR(36) NULL,
  accounting_processed_by_id VARCHAR(36) NULL,
  accounting_processed_at DATETIME NULL,
  opened_at DATETIME NOT NULL,
  resolved_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY delivery_disputes_number_unique (dispute_number),
  UNIQUE KEY delivery_disputes_order_unique (order_id),
  INDEX delivery_disputes_status_idx (status, created_at),
  INDEX delivery_disputes_buyer_idx (buyer_id, created_at),
  INDEX delivery_disputes_refund_idx (refund_status, created_at)
);

CREATE TABLE delivery_dispute_responses (
  id VARCHAR(36) PRIMARY KEY,
  dispute_id VARCHAR(36) NOT NULL,
  author_id VARCHAR(36) NOT NULL,
  author_role VARCHAR(40) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX delivery_dispute_responses_case_idx (dispute_id, created_at)
);

CREATE TABLE delivery_dispute_events (
  id VARCHAR(36) PRIMARY KEY,
  dispute_id VARCHAR(36) NOT NULL,
  actor_id VARCHAR(36) NULL,
  event VARCHAR(80) NOT NULL,
  note TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX delivery_dispute_events_case_idx (dispute_id, created_at)
);
