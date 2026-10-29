import { describe, it, expect } from 'vitest';
import {
  addItem,
  updateQuantity,
  removeItem,
  cartCount,
  cartSubtotal,
  lineKey,
  pruneUnknown,
  createCartStore,
  MAX_QUANTITY,
} from '../../client/src/state/cart.js';
import { buildStops, cameraAt } from '../../client/src/three/productStage.js';

const products = new Map([
  [1, { id: 1, priceCents: 10000 }],
  [2, { id: 2, priceCents: 12000 }],
]);

function memoryStorage() {
  const data = new Map();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
}

describe('carrito', () => {
  it('agrupa líneas iguales (mismo producto y talla) y respeta el máximo', () => {
    let items = addItem([], { productId: 1, size: 'M' });
    items = addItem(items, { productId: 1, size: 'M' });
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({ productId: 1, size: 'M', quantity: 2 });
    items = addItem(items, { productId: 1, size: 'M', quantity: 50 });
    expect(items[0].quantity).toBe(MAX_QUANTITY);
  });

  it('separa líneas con distinta talla', () => {
    let items = addItem([], { productId: 1, size: 'M' });
    items = addItem(items, { productId: 1, size: 'L' });
    items = addItem(items, { productId: 2, size: 'M' });
    expect(items).toHaveLength(3);
    expect(cartCount(items)).toBe(3);
  });

  it('elimina la línea cuando la cantidad llega a cero', () => {
    const items = addItem([], { productId: 2, size: 'S' });
    const key = lineKey(items[0]);
    expect(updateQuantity(items, key, 4)[0].quantity).toBe(4);
    expect(updateQuantity(items, key, 0)).toEqual([]);
    expect(removeItem(items, key)).toEqual([]);
  });

  it('calcula el subtotal por precio y cantidad', () => {
    let items = addItem([], { productId: 1, size: 'M', quantity: 2 });
    items = addItem(items, { productId: 2, size: 'S' });
    expect(cartSubtotal(items, products)).toBe(2 * 10000 + 12000);
  });

  it('limpia carritos guardados con la personalización retirada (sin cargo y agrupando líneas)', () => {
    const storage = memoryStorage();
    storage.setItem(
      'montevar.cart.v1',
      JSON.stringify([
        { productId: 1, size: 'M', quantity: 1, personalization: 'ANA' },
        { productId: 1, size: 'M', quantity: 2, personalization: '' },
      ]),
    );
    const store = createCartStore(storage);
    expect(store.items).toEqual([{ productId: 1, size: 'M', quantity: 3 }]);
    expect(cartSubtotal(store.items, products)).toBe(3 * 10000);
  });

  it('descarta productos que ya no existen en el catálogo', () => {
    const items = [
      { productId: 1, size: 'M', quantity: 1 },
      { productId: 99, size: 'M', quantity: 1 },
    ];
    expect(pruneUnknown(items, products)).toHaveLength(1);
  });

  it('persiste en el almacenamiento y tolera datos corruptos', () => {
    const storage = memoryStorage();
    const store = createCartStore(storage);
    store.add({ productId: 1, size: 'M' });
    expect(createCartStore(storage).items).toHaveLength(1);

    storage.setItem('montevar.cart.v1', '{no-json');
    expect(createCartStore(storage).items).toEqual([]);
  });
});

describe('recorrido de cámara', () => {
  it('genera una parada por característica más inicio y final', () => {
    expect(buildStops(4)).toHaveLength(6);
    expect(buildStops(6)).toHaveLength(8);
  });

  it('nunca atraviesa la chaqueta: la distancia horizontal al centro se mantiene amplia', () => {
    const stops = buildStops(4);
    for (let p = 0; p <= 1; p += 0.01) {
      const { pos } = cameraAt(stops, p);
      expect(Math.hypot(pos.x, pos.z)).toBeGreaterThan(1.8);
    }
  });

  it('gira la prenda para mostrar la espalda solo si existe la foto de la espalda', () => {
    const withBack = buildStops(4, true);
    expect(cameraAt(withBack, 2 / (withBack.length - 1)).turn).toBeCloseTo(Math.PI);
    const withoutBack = buildStops(4, false);
    for (let p = 0; p <= 1; p += 0.05) expect(cameraAt(withoutBack, p).turn).toBe(0);
  });

  it('termina en la parada final con el índice correcto', () => {
    const stops = buildStops(4);
    expect(cameraAt(stops, 1).index).toBe(stops.length - 1);
    expect(cameraAt(stops, 0).index).toBe(0);
  });
});
