export function createOrderRepository(db) {
  return {
    insertOrder({ orderNumber, customerName, customerEmail, totalCents, currency }) {
      const result = db.prepare(`INSERT INTO orders (order_number, customer_name, customer_email, total_cents, currency)
        VALUES (?, ?, ?, ?, ?)`).run(orderNumber, customerName, customerEmail, totalCents, currency);
      return Number(result.lastInsertRowid);
    },
    insertItem(orderId, { productId, sizeLabel, quantity, personalization, unitPriceCents }) {
      db.prepare(`INSERT INTO order_items (order_id, product_id, size_label, quantity, personalization, unit_price_cents)
        VALUES (?, ?, ?, ?, ?, ?)`).run(orderId, productId, sizeLabel, quantity, personalization, unitPriceCents);
    },
    findByNumber(orderNumber) {
      const order = db.prepare(`SELECT id, order_number, customer_name, total_cents, currency, status, created_at
        FROM orders WHERE order_number = ?`).get(orderNumber);
      if (!order) return undefined;
      const items = db.prepare(`SELECT oi.product_id, p.name AS product_name, oi.size_label, oi.quantity, oi.personalization, oi.unit_price_cents
        FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ? ORDER BY oi.id`).all(order.id);
      return { ...order, items };
    },
  };
}
