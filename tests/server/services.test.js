import { describe, it, expect } from 'vitest';
import { unitPrice, generateOrderNumber } from '../../server/services/orderService.js';
import { toProductDto } from '../../server/services/catalogService.js';
import { openDatabase } from '../../server/db/connection.js';
import { migrate } from '../../server/db/migrate.js';
import { seed } from '../../server/db/seed.js';

describe('orderService', () => {
  it('suma el cargo de personalización solo cuando hay nombre', () => {
    expect(unitPrice(10000, '', 900)).toBe(10000);
    expect(unitPrice(10000, 'LUCA', 900)).toBe(10900);
  });

  it('genera números de pedido únicos con prefijo', () => {
    const numbers = new Set(Array.from({ length: 50 }, generateOrderNumber));
    expect(numbers.size).toBe(50);
    [...numbers].forEach((n) => expect(n).toMatch(/^NOC-[0-9A-Z]+-[0-9A-F]{4}$/));
  });
});

describe('catalogService.toProductDto', () => {
  it('oculta el stock exacto y expone solo disponibilidad', () => {
    const dto = toProductDto({
      id: 1, slug: 'x', name: 'X', tagline: 't', description: 'd', price_cents: 100, currency: 'USD', theme: 'loft',
      base_color: '#000', stripe_color: '#fff', trim_color: '#111', accent_color: '#f00', stripe_layout: 'both',
      features: [], sizes: [{ id: 9, label: 'M', stock: 3 }, { id: 10, label: 'L', stock: 0 }],
    });
    expect(dto.sizes).toEqual([{ label: 'M', inStock: true }, { label: 'L', inStock: false }]);
    expect(dto.colors).toEqual({ base: '#000', stripe: '#fff', trim: '#111', accent: '#f00' });
  });
});

describe('migraciones y seeds', () => {
  it('son idempotentes: ejecutarlas dos veces no duplica datos', () => {
    const db = openDatabase(':memory:');
    migrate(db);
    seed(db);
    expect(migrate(db)).toEqual([]);
    seed(db);
    expect(db.prepare('SELECT COUNT(*) AS n FROM products').get().n).toBe(20);
    expect(db.prepare('SELECT COUNT(*) AS n FROM product_features').get().n).toBe(80);
    expect(db.prepare('SELECT COUNT(*) AS n FROM product_sizes').get().n).toBe(91);
  });
});
