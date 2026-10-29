/** Lógica pura del carrito (sin DOM) + un pequeño store persistido en localStorage. */

export const MAX_QUANTITY = 10;
const STORAGE_KEY = 'montevar.cart.v1';
const LEGACY_KEY = 'nocturna.cart.v1'; // nombre anterior de la marca: se migra una vez

/** Una línea del carrito es un producto en una talla. */
export const lineKey = ({ productId, size }) => `${productId}|${size}`;

export function addItem(items, item) {
  const normalized = { productId: item.productId, size: item.size, quantity: item.quantity ?? 1 };
  const key = lineKey(normalized);
  const existing = items.find((i) => lineKey(i) === key);
  if (!existing) return [...items, { ...normalized, quantity: Math.min(normalized.quantity, MAX_QUANTITY) }];
  return items.map((i) => (lineKey(i) === key ? { ...i, quantity: Math.min(i.quantity + normalized.quantity, MAX_QUANTITY) } : i));
}

export function updateQuantity(items, key, quantity) {
  if (quantity <= 0) return removeItem(items, key);
  return items.map((i) => (lineKey(i) === key ? { ...i, quantity: Math.min(quantity, MAX_QUANTITY) } : i));
}

export const removeItem = (items, key) => items.filter((i) => lineKey(i) !== key);

export const cartCount = (items) => items.reduce((n, i) => n + i.quantity, 0);

export function linePrice(item, product) {
  if (!product) return 0;
  return product.priceCents * item.quantity;
}

export function cartSubtotal(items, productsById) {
  return items.reduce((sum, item) => sum + linePrice(item, productsById.get(item.productId)), 0);
}

/** Descarta líneas cuyo producto ya no existe en el catálogo actual. */
export const pruneUnknown = (items, productsById) => items.filter((i) => productsById.has(i.productId));

/**
 * Carritos guardados con versiones anteriores pueden traer un nombre personalizado (opción retirada):
 * se descarta y las líneas iguales se agrupan, así no queda ningún cargo extra.
 */
const normalizeSaved = (saved) => (Array.isArray(saved) ? saved : []).filter((i) => i && i.productId != null && i.size).reduce(addItem, []);

export function createCartStore(storage = globalThis.localStorage) {
  let items = [];
  try {
    items = normalizeSaved(JSON.parse(storage?.getItem(STORAGE_KEY) ?? storage?.getItem(LEGACY_KEY) ?? '[]'));
  } catch {
    items = [];
  }
  const listeners = new Set();
  const commit = (next) => {
    items = next;
    try {
      storage?.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* almacenamiento no disponible (modo privado): el carrito sigue en memoria */
    }
    listeners.forEach((fn) => fn(items));
  };
  return {
    get items() {
      return items;
    },
    subscribe(fn) {
      listeners.add(fn);
      fn(items);
      return () => listeners.delete(fn);
    },
    add: (item) => commit(addItem(items, item)),
    setQuantity: (key, qty) => commit(updateQuantity(items, key, qty)),
    remove: (key) => commit(removeItem(items, key)),
    replace: (next) => commit(next),
    clear: () => commit([]),
  };
}
