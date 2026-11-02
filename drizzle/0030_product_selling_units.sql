ALTER TABLE products
  ADD COLUMN IF NOT EXISTS selling_unit ENUM('kg', 'tray') NOT NULL DEFAULT 'kg' AFTER image_url;

UPDATE products
SET selling_unit = 'tray'
WHERE LOWER(name) REGEXP '(^|[[:space:]])(egg|itlog)([[:space:]]|$)';

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS selling_unit ENUM('kg', 'tray') NOT NULL DEFAULT 'kg' AFTER classification_name;

UPDATE order_items AS item
INNER JOIN marketplace_listings AS listing ON listing.id = item.listing_id
INNER JOIN products AS product ON product.id = listing.product_id
SET item.selling_unit = product.selling_unit;
