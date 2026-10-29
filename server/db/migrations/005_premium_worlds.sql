-- foreign_keys: off
-- Reemplaza los mundos urbanos (neon, street, studio) por mundos premium: "pavilion" (pabellón de
-- concreto, chaquetas de pista) y "loft" (loft industrial, oversize). "atelier" sigue para la línea formal.
-- SQLite no permite cambiar un CHECK: se reconstruye la tabla según el procedimiento oficial
-- (claves foráneas desactivadas fuera de la transacción, copia, reemplazo y verificación).

CREATE TABLE products_new (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  slug          TEXT    NOT NULL UNIQUE,
  name          TEXT    NOT NULL,
  tagline       TEXT    NOT NULL,
  description   TEXT    NOT NULL,
  price_cents   INTEGER NOT NULL CHECK (price_cents >= 0),
  currency      TEXT    NOT NULL DEFAULT 'USD',
  theme         TEXT    NOT NULL CHECK (theme IN ('atelier', 'pavilion', 'loft')),
  base_color    TEXT    NOT NULL,
  stripe_color  TEXT    NOT NULL,
  trim_color    TEXT    NOT NULL,
  accent_color  TEXT    NOT NULL,
  stripe_layout TEXT    NOT NULL DEFAULT 'sleeves' CHECK (stripe_layout IN ('sleeves', 'back', 'both')),
  sort_order    INTEGER NOT NULL DEFAULT 0,
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  category_slug TEXT REFERENCES categories (slug),
  featured      INTEGER NOT NULL DEFAULT 0
);

INSERT INTO products_new (id, slug, name, tagline, description, price_cents, currency, theme, base_color, stripe_color,
  trim_color, accent_color, stripe_layout, sort_order, active, created_at, updated_at, category_slug, featured)
SELECT id, slug, name, tagline, description, price_cents, currency,
  CASE WHEN theme = 'atelier' OR category_slug = 'formal' THEN 'atelier' WHEN category_slug = 'oversize' THEN 'loft' ELSE 'pavilion' END,
  base_color, stripe_color,
  trim_color, accent_color, stripe_layout, sort_order, active, created_at, updated_at, category_slug, featured
FROM products;

DROP TABLE products;
ALTER TABLE products_new RENAME TO products;
CREATE INDEX idx_products_active_order ON products (active, sort_order);
CREATE INDEX idx_products_category ON products (category_slug, sort_order);
