CREATE TABLE products (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  slug          TEXT    NOT NULL UNIQUE,
  name          TEXT    NOT NULL,
  tagline       TEXT    NOT NULL,
  description   TEXT    NOT NULL,
  price_cents   INTEGER NOT NULL CHECK (price_cents >= 0),
  currency      TEXT    NOT NULL DEFAULT 'USD',
  theme         TEXT    NOT NULL CHECK (theme IN ('neon', 'street', 'studio')),
  base_color    TEXT    NOT NULL,
  stripe_color  TEXT    NOT NULL,
  trim_color    TEXT    NOT NULL,
  accent_color  TEXT    NOT NULL,
  stripe_layout TEXT    NOT NULL DEFAULT 'sleeves' CHECK (stripe_layout IN ('sleeves', 'back', 'both')),
  sort_order    INTEGER NOT NULL DEFAULT 0,
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_products_active_order ON products (active, sort_order);

CREATE TABLE product_features (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id  INTEGER NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  title       TEXT    NOT NULL,
  body        TEXT    NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_features_product ON product_features (product_id, sort_order);

CREATE TABLE product_sizes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id  INTEGER NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  label       TEXT    NOT NULL,
  stock       INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  UNIQUE (product_id, label)
);

CREATE TABLE site_content (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE orders (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number    TEXT    NOT NULL UNIQUE,
  customer_name   TEXT    NOT NULL,
  customer_email  TEXT    NOT NULL,
  total_cents     INTEGER NOT NULL,
  currency        TEXT    NOT NULL,
  status          TEXT    NOT NULL DEFAULT 'received',
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE order_items (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id          INTEGER NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  product_id        INTEGER NOT NULL REFERENCES products (id),
  size_label        TEXT    NOT NULL,
  quantity          INTEGER NOT NULL CHECK (quantity > 0),
  personalization   TEXT    NOT NULL DEFAULT '',
  unit_price_cents  INTEGER NOT NULL
);
CREATE INDEX idx_order_items_order ON order_items (order_id);
