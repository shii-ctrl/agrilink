-- Permanent product-quality offers are independent from any one Farmer's stock row.
-- Existing balances become opening lots. Future receiving creates one immutable
-- Farmer-owned lot per delivery and quality, which makes FIFO allocation exact.
ALTER TABLE inventory
  ADD COLUMN receiving_id VARCHAR(36) NULL AFTER farmer_id,
  ADD COLUMN received_at DATETIME NULL AFTER reserved_kg;

UPDATE inventory
SET received_at = updated_at
WHERE received_at IS NULL;

ALTER TABLE inventory
  MODIFY received_at DATETIME NOT NULL,
  DROP INDEX inventory_product_classification_farmer_unique,
  ADD KEY inventory_product_classification_lot_idx (product_id, classification_id, received_at),
  ADD KEY inventory_receiving_idx (receiving_id),
  ADD CONSTRAINT fk_inventory_receiving FOREIGN KEY (receiving_id) REFERENCES receiving_records(id);

ALTER TABLE marketplace_listings
  ADD COLUMN product_id VARCHAR(36) NULL AFTER inventory_id,
  ADD COLUMN classification_id INT NULL AFTER product_id,
  ADD COLUMN price_configured BOOLEAN NOT NULL DEFAULT FALSE AFTER retail_price_per_kg;

UPDATE marketplace_listings AS listing
INNER JOIN inventory AS stock ON stock.id = listing.inventory_id
SET listing.product_id = stock.product_id,
    listing.classification_id = stock.classification_id
WHERE listing.product_id IS NULL OR listing.classification_id IS NULL;

-- Legacy offers already have Marketer-entered prices. Newly prepared draft offers
-- remain unconfigured until a Marketer explicitly saves their pricing form.
UPDATE marketplace_listings
SET price_configured = TRUE;

-- Keep the newest offer as the controller for each product-quality pair.
CREATE TEMPORARY TABLE canonical_marketplace_listings AS
SELECT
  product_id,
  classification_id,
  SUBSTRING_INDEX(
    GROUP_CONCAT(id ORDER BY updated_at DESC, created_at DESC, id DESC SEPARATOR ','),
    ',',
    1
  ) AS canonical_id
FROM marketplace_listings
GROUP BY product_id, classification_id;

-- Consolidate any active cart that happened to contain two legacy listings for the
-- same product-quality. Reservation movements follow the retained cart item.
CREATE TEMPORARY TABLE cart_item_targets AS
SELECT
  item.id AS old_item_id,
  item.cart_id,
  canonical.canonical_id AS canonical_listing_id,
  item.quantity_kg,
  item.reservation_expires_at
FROM cart_items AS item
INNER JOIN marketplace_listings AS old_listing ON old_listing.id = item.listing_id
INNER JOIN canonical_marketplace_listings AS canonical
  ON canonical.product_id = old_listing.product_id
 AND canonical.classification_id = old_listing.classification_id;

CREATE TEMPORARY TABLE canonical_cart_items AS
SELECT
  cart_id,
  canonical_listing_id,
  MIN(old_item_id) AS keeper_id,
  SUM(quantity_kg) AS quantity_kg,
  MAX(reservation_expires_at) AS reservation_expires_at
FROM cart_item_targets
GROUP BY cart_id, canonical_listing_id;

UPDATE inventory_movements AS movement
INNER JOIN cart_item_targets AS target
  ON movement.reference_type = 'cart'
 AND movement.reference_id = target.old_item_id
INNER JOIN canonical_cart_items AS canonical
  ON canonical.cart_id = target.cart_id
 AND canonical.canonical_listing_id = target.canonical_listing_id
SET movement.reference_id = canonical.keeper_id;

DELETE item
FROM cart_items AS item
INNER JOIN cart_item_targets AS target ON target.old_item_id = item.id
INNER JOIN canonical_cart_items AS canonical
  ON canonical.cart_id = target.cart_id
 AND canonical.canonical_listing_id = target.canonical_listing_id
WHERE item.id <> canonical.keeper_id;

UPDATE cart_items AS item
INNER JOIN canonical_cart_items AS canonical ON canonical.keeper_id = item.id
SET item.listing_id = canonical.canonical_listing_id,
    item.quantity_kg = canonical.quantity_kg,
    item.reservation_expires_at = canonical.reservation_expires_at;

DROP TEMPORARY TABLE cart_item_targets;
DROP TEMPORARY TABLE canonical_cart_items;

UPDATE order_items AS item
INNER JOIN marketplace_listings AS old_listing ON old_listing.id = item.listing_id
INNER JOIN canonical_marketplace_listings AS canonical
  ON canonical.product_id = old_listing.product_id
 AND canonical.classification_id = old_listing.classification_id
SET item.listing_id = canonical.canonical_id
WHERE item.listing_id <> canonical.canonical_id;

UPDATE daily_prices AS price
INNER JOIN marketplace_listings AS old_listing ON old_listing.id = price.listing_id
INNER JOIN canonical_marketplace_listings AS canonical
  ON canonical.product_id = old_listing.product_id
 AND canonical.classification_id = old_listing.classification_id
SET price.listing_id = canonical.canonical_id
WHERE price.listing_id <> canonical.canonical_id;

DELETE listing
FROM marketplace_listings AS listing
INNER JOIN canonical_marketplace_listings AS canonical
  ON canonical.product_id = listing.product_id
 AND canonical.classification_id = listing.classification_id
WHERE listing.id <> canonical.canonical_id;

DROP TEMPORARY TABLE canonical_marketplace_listings;

ALTER TABLE marketplace_listings
  MODIFY inventory_id VARCHAR(36) NULL,
  MODIFY product_id VARCHAR(36) NOT NULL,
  MODIFY classification_id INT NOT NULL,
  DROP INDEX listings_inventory_unique,
  ADD KEY listings_inventory_idx (inventory_id),
  ADD UNIQUE KEY listings_product_classification_unique (product_id, classification_id),
  ADD KEY listings_product_idx (product_id),
  ADD CONSTRAINT fk_listing_product FOREIGN KEY (product_id) REFERENCES products(id),
  ADD CONSTRAINT fk_listing_classification FOREIGN KEY (classification_id) REFERENCES classifications(id);

-- Every active product receives permanent Good and Semi draft offers. Prices remain
-- internal placeholders until a Marketer explicitly saves and publishes the offer.
INSERT INTO marketplace_listings (
  id,
  inventory_id,
  product_id,
  classification_id,
  price_per_kg,
  retail_price_per_kg,
  price_configured,
  status
)
SELECT
  UUID(),
  NULL,
  product.id,
  classification.id,
  0.01,
  0.01,
  FALSE,
  'draft'
FROM products AS product
CROSS JOIN classifications AS classification
LEFT JOIN marketplace_listings AS existing
  ON existing.product_id = product.id
 AND existing.classification_id = classification.id
WHERE classification.name IN ('Good', 'Semi')
  AND existing.id IS NULL;

-- Snapshot display data keeps historical orders unchanged when the catalog is edited.
ALTER TABLE order_items
  ADD COLUMN product_name VARCHAR(160) NULL AFTER price_per_kg,
  ADD COLUMN classification_name VARCHAR(20) NULL AFTER product_name,
  ADD COLUMN image_url MEDIUMTEXT NULL AFTER classification_name;

UPDATE order_items AS item
INNER JOIN marketplace_listings AS listing ON listing.id = item.listing_id
INNER JOIN products AS product ON product.id = listing.product_id
INNER JOIN classifications AS classification ON classification.id = listing.classification_id
SET item.product_name = product.name,
    item.classification_name = classification.name,
    item.image_url = product.image_url
WHERE item.product_name IS NULL;
