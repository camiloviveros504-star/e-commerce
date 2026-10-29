CREATE TABLE categories (
  slug        TEXT PRIMARY KEY,
  name        TEXT    NOT NULL,
  description TEXT    NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0
);

-- Categoría de cada prenda y si aparece destacada en el showroom 3D del inicio.
ALTER TABLE products ADD COLUMN category_slug TEXT REFERENCES categories (slug);
ALTER TABLE products ADD COLUMN featured INTEGER NOT NULL DEFAULT 0;
CREATE INDEX idx_products_category ON products (category_slug, sort_order);
