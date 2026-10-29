import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transaction } from './connection.js';

const CATALOG_PATH = join(dirname(fileURLToPath(import.meta.url)), 'seeds', 'catalog.json');

export function loadCatalog(path = CATALOG_PATH) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** Carga (o actualiza) contenido y catálogo. Es idempotente: se puede ejecutar varias veces. */
export function seed(db, catalog = loadCatalog()) {
  transaction(db, () => {
    const upsertContent = db.prepare(`INSERT INTO site_content (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`);
    for (const [key, value] of Object.entries(catalog.content)) upsertContent.run(key, String(value));

    const upsertCategory = db.prepare(`INSERT INTO categories (slug, name, description, sort_order) VALUES (?, ?, ?, ?)
      ON CONFLICT(slug) DO UPDATE SET name = excluded.name, description = excluded.description, sort_order = excluded.sort_order`);
    (catalog.categories ?? []).forEach((c, i) => upsertCategory.run(c.slug, c.name, c.description ?? '', i));

    const upsertProduct = db.prepare(`INSERT INTO products
      (slug, name, tagline, description, price_cents, currency, theme, base_color, stripe_color, trim_color, accent_color,
       stripe_layout, sort_order, category_slug, featured)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(slug) DO UPDATE SET name = excluded.name, tagline = excluded.tagline, description = excluded.description,
        price_cents = excluded.price_cents, currency = excluded.currency, theme = excluded.theme, base_color = excluded.base_color,
        stripe_color = excluded.stripe_color, trim_color = excluded.trim_color, accent_color = excluded.accent_color,
        stripe_layout = excluded.stripe_layout, sort_order = excluded.sort_order, category_slug = excluded.category_slug,
        featured = excluded.featured, updated_at = datetime('now')`);
    const findId = db.prepare('SELECT id FROM products WHERE slug = ?');
    const clearFeatures = db.prepare('DELETE FROM product_features WHERE product_id = ?');
    const insertFeature = db.prepare('INSERT INTO product_features (product_id, title, body, sort_order) VALUES (?, ?, ?, ?)');
    const upsertSize = db.prepare(`INSERT INTO product_sizes (product_id, label, stock, sort_order) VALUES (?, ?, ?, ?)
      ON CONFLICT(product_id, label) DO UPDATE SET stock = excluded.stock, sort_order = excluded.sort_order`);
    const clearImages = db.prepare('DELETE FROM product_images WHERE product_id = ?');
    const insertImage = db.prepare(`INSERT INTO product_images (product_id, kind, url, alt, width, height, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)`);

    catalog.products.forEach((p, index) => {
      upsertProduct.run(p.slug, p.name, p.tagline, p.description, p.price_cents, p.currency, p.theme,
        p.base_color, p.stripe_color, p.trim_color, p.accent_color, p.stripe_layout, index, p.category ?? null, p.featured ? 1 : 0);
      const { id } = findId.get(p.slug);
      clearFeatures.run(id);
      p.features.forEach(([title, body], i) => insertFeature.run(id, title, body, i));
      p.sizes.forEach(([label, stock], i) => upsertSize.run(id, label, stock, i));
      clearImages.run(id);
      (p.images ?? []).forEach((img, i) => insertImage.run(id, img.kind, img.url, img.alt, img.width, img.height, i));
    });
  });
}
