-- Each permanent product-quality offer can show its own marketplace photo.
-- Start with the existing catalog photo so deployment does not create broken images;
-- Marketers can replace Good, Semi, and Reject photos independently afterward.
ALTER TABLE marketplace_listings
  ADD COLUMN image_url MEDIUMTEXT NULL AFTER bundle_minimum_kg;

UPDATE marketplace_listings AS listing
INNER JOIN products AS product ON product.id = listing.product_id
SET listing.image_url = product.image_url
WHERE listing.image_url IS NULL;
