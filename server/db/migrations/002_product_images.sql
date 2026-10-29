CREATE TABLE product_images (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id  INTEGER NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  kind        TEXT    NOT NULL CHECK (kind IN ('front', 'back', 'detail', 'lifestyle')),
  url         TEXT    NOT NULL,
  alt         TEXT    NOT NULL,
  width       INTEGER NOT NULL CHECK (width > 0),
  height      INTEGER NOT NULL CHECK (height > 0),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  UNIQUE (product_id, kind)
);
CREATE INDEX idx_product_images_product ON product_images (product_id, sort_order);
