ALTER TABLE products
  MODIFY COLUMN selling_unit ENUM('kg', 'piece', 'bundle', 'pack', 'tray', 'sack') NOT NULL DEFAULT 'kg';

ALTER TABLE order_items
  MODIFY COLUMN selling_unit ENUM('kg', 'piece', 'bundle', 'pack', 'tray', 'sack') NOT NULL DEFAULT 'kg';
