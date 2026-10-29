import { describe, expect, it } from 'vitest';
import { buildOrderMessage, whatsappUrl } from '../../client/src/state/whatsapp.js';

const productsById = new Map([
  [1, { id: 1, slug: 'blazer', name: 'Blazer Soberano', category: 'formal', priceCents: 76000000, currency: 'COP' }],
  [2, { id: 2, slug: 'aurum', name: 'Aurum 38', category: 'relojeria', priceCents: 272000000, currency: 'COP' }],
]);
const categoryNames = new Map([
  ['formal', 'Formal'],
  ['relojeria', 'Relojería'],
]);
// Normaliza espacios (Intl usa espacios no separables entre "$" y la cifra).
const plain = (text) => text.replace(/\s/g, ' ');

describe('pedido por WhatsApp', () => {
  const items = [
    { productId: 1, size: 'M', quantity: 2 },
    { productId: 2, size: 'Correa M', quantity: 1 },
  ];
  const message = plain(
    buildOrderMessage({
      items,
      productsById,
      categoryNames,
      currency: 'COP',
      brand: 'MONTEVAR',
      origin: 'https://tienda.co',
      customerName: 'Juan',
    }),
  );

  it('incluye los datos exactos de cada prenda', () => {
    expect(message).toContain('Hola, MONTEVAR. Quiero hacer este pedido:');
    expect(message).toContain('1. Blazer Soberano (Ref. BLAZER)');
    expect(message).toContain('Línea: Formal · Talla: M · Cantidad: 2');
    expect(message).toContain('Precio unitario: $ 760.000 · Subtotal: $ 1.520.000');
    expect(message).toContain('https://tienda.co/producto/blazer');
    expect(message).toContain('2. Aurum 38 (Ref. AURUM)');
    expect(message).toContain('Línea: Relojería · Talla: Correa M · Cantidad: 1');
    expect(message).not.toContain('Personalización');
  });

  it('cierra con el total en pesos, la cantidad de prendas y el nombre', () => {
    expect(message).toContain('Total: $ 4.240.000 (3 piezas)');
    expect(message).toContain('Nombre: Juan');
  });

  it('arma el enlace de WhatsApp con el número (solo dígitos) o sin número', () => {
    expect(whatsappUrl('+57 300 123 4567', 'Hola & chao')).toBe('https://wa.me/573001234567?text=Hola%20%26%20chao');
    expect(whatsappUrl('', 'Hola')).toBe('https://wa.me/?text=Hola');
  });
});
