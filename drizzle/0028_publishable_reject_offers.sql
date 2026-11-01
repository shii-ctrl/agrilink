-- Reject is now a buyer-selectable quality with the same pooled-stock and FIFO
-- ownership rules as Good and Semi. Existing stock and history remain unchanged.
-- New offers start hidden with placeholder prices until a Marketer explicitly
-- configures and publishes them from Product Catalog.
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
INNER JOIN classifications AS classification
  ON classification.name = 'Reject'
LEFT JOIN marketplace_listings AS existing
  ON existing.product_id = product.id
 AND existing.classification_id = classification.id
WHERE existing.id IS NULL;
