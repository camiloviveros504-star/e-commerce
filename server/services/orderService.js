import { randomBytes } from 'node:crypto';
import { transaction } from '../db/connection.js';
import { conflict, notFound, validationError } from '../errors.js';
import { orderSchema, formatZodIssues } from '../validators/orderSchema.js';

export function generateOrderNumber() {
  return `NOC-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}`;
}

/** Precio unitario de una línea: el precio del producto más el cargo por personalización si aplica. */
export function unitPrice(productPriceCents, personalization, personalizationFeeCents) {
  return productPriceCents + (personalization ? personalizationFeeCents : 0);
}

export function createOrderService({ db, productRepository, orderRepository, contentRepository }) {
  return {
    /** Crea el pedido. Los precios siempre se calculan en el servidor, nunca se confía en el cliente. */
    createOrder(input) {
      const parsed = orderSchema.safeParse(input);
      if (!parsed.success) throw validationError(formatZodIssues(parsed.error));
      const { customer, items } = parsed.data;
      const feeCents = Number(contentRepository.get('personalization_fee_cents') ?? 0);

      return transaction(db, () => {
        const lines = items.map((item, index) => {
          const product = productRepository.findById(item.productId);
          if (!product) throw validationError([{ path: `items.${index}.productId`, message: 'Producto no disponible' }]);
          const size = product.sizes.find((s) => s.label === item.size);
          if (!size) throw validationError([{ path: `items.${index}.size`, message: 'Talla no disponible' }]);
          if (!productRepository.decrementStock(size.id, item.quantity)) {
            throw conflict(`Sin stock suficiente de ${product.name} talla ${item.size}`, [{ path: `items.${index}.quantity` }]);
          }
          return {
            productId: product.id,
            currency: product.currency,
            sizeLabel: size.label,
            quantity: item.quantity,
            personalization: item.personalization,
            unitPriceCents: unitPrice(product.price_cents, item.personalization, feeCents),
          };
        });

        const currencies = new Set(lines.map((l) => l.currency));
        if (currencies.size > 1) throw validationError([{ path: 'items', message: 'Monedas mezcladas' }]);
        const totalCents = lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0);
        const orderNumber = generateOrderNumber();
        const orderId = orderRepository.insertOrder({
          orderNumber,
          customerName: customer.name,
          customerEmail: customer.email,
          totalCents,
          currency: lines[0].currency,
        });
        lines.forEach((line) => orderRepository.insertItem(orderId, line));
        return { orderNumber, totalCents, currency: lines[0].currency, itemCount: lines.reduce((n, l) => n + l.quantity, 0) };
      });
    },

    getOrder(orderNumber) {
      const order = orderRepository.findByNumber(orderNumber);
      if (!order) throw notFound('Pedido no encontrado');
      return {
        orderNumber: order.order_number,
        customerName: order.customer_name,
        totalCents: order.total_cents,
        currency: order.currency,
        status: order.status,
        createdAt: order.created_at,
        items: order.items.map((i) => ({
          productId: i.product_id,
          productName: i.product_name,
          size: i.size_label,
          quantity: i.quantity,
          personalization: i.personalization,
          unitPriceCents: i.unit_price_cents,
        })),
      };
    },
  };
}
