-- Standardize every saved catalog product into the six PROCY market sections.
-- Product-name matches take priority so established products retain their
-- intended market section; unknown legacy labels become Other Commodities.
UPDATE products
SET crop_type = CASE
  WHEN LOWER(TRIM(name)) LIKE 'tomato%' OR LOWER(TRIM(name)) LIKE 'kamatis%' THEN 'Lowland Crops'
  WHEN LOWER(TRIM(name)) LIKE 'eggplant%' OR LOWER(TRIM(name)) LIKE 'talong%' THEN 'Lowland Crops'
  WHEN LOWER(TRIM(name)) LIKE 'cabbage%' OR LOWER(TRIM(name)) LIKE 'repolyo%' THEN 'Highland Crops'
  WHEN LOWER(TRIM(name)) LIKE 'carrot%' THEN 'Highland Crops'
  WHEN LOWER(TRIM(name)) LIKE 'mango%' OR LOWER(TRIM(name)) LIKE 'manga%' THEN 'Fruits'
  WHEN LOWER(TRIM(name)) LIKE 'radish%' OR LOWER(TRIM(name)) LIKE 'labanos%' THEN 'Root Crops'
  WHEN crop_type IN ('Root Vegetable', 'Root vegetable', 'Tuber Vegetable', 'Tuber vegetable') THEN 'Root Crops'
  WHEN crop_type IN ('Fruit Vegetable', 'Fruit vegetable', 'Fruiting Vegetable', 'Fruiting vegetable', 'Legume', 'Herb') THEN 'Lowland Crops'
  WHEN crop_type IN ('Leafy Vegetable', 'Leafy vegetable', 'Cruciferous Vegetable', 'Cruciferous vegetable') THEN 'Highland Crops'
  ELSE 'Other Commodities'
END
WHERE crop_type NOT IN (
  'Lowland Crops',
  'Highland Crops',
  'Fruits',
  'Root Crops',
  'Staple Crops',
  'Other Commodities'
);
