CREATE TABLE order_feedback (
  id VARCHAR(36) PRIMARY KEY,
  order_id VARCHAR(36) NOT NULL,
  buyer_id VARCHAR(36) NOT NULL,
  service_rating INT NOT NULL,
  rider_rating INT NULL,
  comment TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY order_feedback_order_unique (order_id),
  INDEX order_feedback_buyer_idx (buyer_id, created_at),
  CONSTRAINT order_feedback_service_rating_check CHECK (service_rating BETWEEN 1 AND 5),
  CONSTRAINT order_feedback_rider_rating_check CHECK (rider_rating IS NULL OR rider_rating BETWEEN 1 AND 5)
);

CREATE TABLE order_item_ratings (
  id VARCHAR(36) PRIMARY KEY,
  feedback_id VARCHAR(36) NOT NULL,
  order_item_id VARCHAR(36) NOT NULL,
  product_id VARCHAR(36) NOT NULL,
  rating INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY order_item_ratings_order_item_unique (order_item_id),
  INDEX order_item_ratings_feedback_idx (feedback_id),
  INDEX order_item_ratings_product_idx (product_id, created_at),
  CONSTRAINT order_item_ratings_rating_check CHECK (rating BETWEEN 1 AND 5)
);
