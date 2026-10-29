import { cartSubtotal, linePrice } from './cart.js';
import { formatMoney } from '../ui/format.js';

/**
 * Pedido por WhatsApp: arma el mensaje con los datos exactos de cada prenda del carrito
 * (nombre, referencia, línea, talla, cantidad, precios y enlace) y el enlace wa.me.
 */
export function buildOrderMessage({ items, productsById, categoryNames = new Map(), currency = 'COP', brand = '', origin = '', customerName = '' }) {
  const money = (cents) => formatMoney(cents, currency);
  const lines = items
    .map((item, i) => {
      const product = productsById.get(item.productId);
      if (!product) return null;
      const detail = [
        `${i + 1}. ${product.name} (Ref. ${product.slug.toUpperCase()})`,
        `   Línea: ${categoryNames.get(product.category) ?? product.category} · Talla: ${item.size} · Cantidad: ${item.quantity}`,
        `   Precio unitario: ${money(product.priceCents)} · Subtotal: ${money(linePrice(item, product))}`,
      ];
      if (origin) detail.push(`   ${origin}/producto/${product.slug}`);
      return detail.join('\n');
    })
    .filter(Boolean);

  const total = cartSubtotal(items, productsById);
  const units = items.reduce((sum, item) => sum + item.quantity, 0);
  return [
    `Hola${brand ? `, ${brand}` : ''}. Quiero hacer este pedido:`,
    '',
    lines.join('\n\n'),
    '',
    `Total: ${money(total)} (${units} ${units === 1 ? 'pieza' : 'piezas'})`,
    customerName ? `Nombre: ${customerName}` : null,
    '',
    '¿Me confirman disponibilidad y forma de pago?',
  ]
    .filter((line) => line !== null)
    .join('\n');
}

/** Enlace de WhatsApp: al número de la tienda si está configurado; si no, deja elegir el contacto. */
export function whatsappUrl(number, text) {
  const digits = String(number ?? '').replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
