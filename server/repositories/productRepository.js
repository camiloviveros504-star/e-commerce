const PRODUCT_COLUMNS = `id, slug, name, tagline, description, price_cents, currency, theme,
  base_color, stripe_color, trim_color, accent_color, stripe_layout, category_slug, featured`;

export function createProductRepository(db) {
  const featuresStmt = db.prepare('SELECT title, body FROM product_features WHERE product_id = ? ORDER BY sort_order');
  const sizesStmt = db.prepare('SELECT id, label, stock FROM product_sizes WHERE product_id = ? ORDER BY sort_order');

  const imagesStmt = db.prepare('SELECT kind, url, alt, width, height FROM product_images WHERE product_id = ? ORDER BY sort_order');

  const withDetails = (row) =>
    row && { ...row, features: featuresStmt.all(row.id), sizes: sizesStmt.all(row.id), images: imagesStmt.all(row.id) };

  return {
    listCategories() {
      return db.prepare('SELECT slug, name, description FROM categories ORDER BY sort_order').all();
    },
    listActive() {
      return db.prepare(`SELECT ${PRODUCT_COLUMNS} FROM products WHERE active = 1 ORDER BY sort_order`).all().map(withDetails);
    },
    findBySlug(slug) {
      return withDetails(db.prepare(`SELECT ${PRODUCT_COLUMNS} FROM products WHERE slug = ? AND active = 1`).get(slug));
    },
    findById(id) {
      return withDetails(db.prepare(`SELECT ${PRODUCT_COLUMNS} FROM products WHERE id = ? AND active = 1`).get(id));
    },
    /** Descuenta stock solo si alcanza. Devuelve true si se actualizó. */
    decrementStock(sizeId, quantity) {
      const result = db.prepare('UPDATE product_sizes SET stock = stock - ? WHERE id = ? AND stock >= ?').run(quantity, sizeId, quantity);
      return result.changes === 1;
    },
  };
}
