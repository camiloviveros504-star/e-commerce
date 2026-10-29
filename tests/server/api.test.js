import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestContext } from './helpers.js';

let ctx;
beforeEach(() => {
  ctx = createTestContext();
});

const stockOf = (db, slug, label) =>
  db.prepare('SELECT s.stock FROM product_sizes s JOIN products p ON p.id = s.product_id WHERE p.slug = ? AND s.label = ?').get(slug, label).stock;
const productId = (db, slug) => db.prepare('SELECT id FROM products WHERE slug = ?').get(slug).id;
const validOrder = (db, overrides = {}) => ({
  customer: { name: 'Ana Pérez', email: 'ANA@example.com' },
  items: [{ productId: productId(db, 'carmesi'), size: 'M', quantity: 2, personalization: 'Ana' }],
  ...overrides,
});

describe('GET /api/products', () => {
  it('devuelve el catálogo desde la base de datos con características y tallas', async () => {
    const res = await request(ctx.app).get('/api/products');
    expect(res.status).toBe(200);
    expect(res.body.meta.count).toBe(20);
    const carmesi = res.body.data.find((p) => p.slug === 'carmesi');
    expect(carmesi).toMatchObject({ name: 'Rubí Imperial', priceCents: 52000000, currency: 'COP', theme: 'pavilion', stripeLayout: 'both' });
    expect(carmesi.features).toHaveLength(4);
    expect(carmesi.sizes[0]).toEqual({ label: 'XS', inStock: true });
  });

  it('refleja cambios hechos en la BD sin tocar código', async () => {
    ctx.db.prepare("UPDATE products SET name = 'Edición Especial', active = 1 WHERE slug = 'grafito'").run();
    ctx.db.prepare("UPDATE products SET active = 0 WHERE slug = 'glaciar'").run();
    const res = await request(ctx.app).get('/api/products');
    const names = res.body.data.map((p) => p.name);
    // El cambio de nombre se refleja y se respeta el orden del catálogo (grafito va justo antes que carmesí).
    const renamed = names.indexOf('Edición Especial');
    expect(renamed).toBeGreaterThanOrEqual(0);
    expect(names[renamed + 1]).toBe('Rubí Imperial');
    expect(names).not.toContain('Perla Boreal');
  });

  it('incluye las fotos del producto indexadas por tipo', async () => {
    const res = await request(ctx.app).get('/api/products/carmesi');
    const { images } = res.body.data;
    expect(images.front).toMatchObject({ url: '/images/products/carmesi/front.webp', width: expect.any(Number), height: expect.any(Number) });
    expect(images.back.alt).toMatch(/espalda/);
    expect(Object.keys(images).sort()).toEqual(['back', 'detail', 'front', 'lifestyle']);
  });

  it('omite los tipos de foto que no existen en la BD', async () => {
    ctx.db.prepare("DELETE FROM product_images WHERE kind = 'detail'").run();
    const res = await request(ctx.app).get('/api/products/grafito');
    expect(res.body.data.images.detail).toBeUndefined();
    expect(res.body.data.images.front).toBeDefined();
  });

  it('marca como agotadas las tallas sin stock', async () => {
    const res = await request(ctx.app).get('/api/products/grafito');
    expect(res.body.data.sizes.find((s) => s.label === 'XL').inStock).toBe(false);
  });

  it('responde 404 con formato de error uniforme para un producto inexistente', async () => {
    const res = await request(ctx.app).get('/api/products/no-existe');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('GET /api/categories', () => {
  it('lista las categorías en orden y cada producto indica la suya', async () => {
    const res = await request(ctx.app).get('/api/categories');
    expect(res.status).toBe(200);
    expect(res.body.data.map((c) => c.slug)).toEqual(['formal', 'chaquetas', 'oversize', 'relojeria']);

    const products = (await request(ctx.app).get('/api/products')).body.data;
    expect(products.filter((p) => p.featured).map((p) => p.slug)).toEqual(['blazer', 'jersey', 'camisa']);
    expect(products.find((p) => p.slug === 'blazer')).toMatchObject({ category: 'formal', featured: true });
    expect(products.filter((p) => p.category === 'oversize')).toHaveLength(5);
  });

  it('cada línea tiene su mundo premium (migraciones 004 y 005)', async () => {
    const products = (await request(ctx.app).get('/api/products')).body.data;
    const themeOf = (category) => [...new Set(products.filter((p) => p.category === category).map((p) => p.theme))];
    expect(themeOf('formal')).toEqual(['atelier']);
    expect(themeOf('chaquetas')).toEqual(['pavilion']);
    expect(themeOf('oversize')).toEqual(['loft']);
  });

  it('el CHECK de la BD rechaza un mundo desconocido', () => {
    expect(() => ctx.db.prepare("UPDATE products SET theme = 'neon' WHERE slug = 'blazer'").run()).toThrow(/CHECK/);
  });
});

describe('GET /api/content', () => {
  it('entrega los textos del sitio guardados en la BD', async () => {
    const res = await request(ctx.app).get('/api/content');
    expect(res.status).toBe(200);
    expect(res.body.data.marquee_text).toBe('OBSIDIANA');
    expect(res.body.data.personalization_fee_cents).toBe('3500000');
  });
});

describe('POST /api/orders', () => {
  it('crea el pedido, calcula el total en el servidor y descuenta stock', async () => {
    const before = stockOf(ctx.db, 'carmesi', 'M');
    const res = await request(ctx.app).post('/api/orders').send(validOrder(ctx.db));
    expect(res.status).toBe(201);
    expect(res.body.data.totalCents).toBe((52000000 + 3500000) * 2);
    expect(res.body.data.orderNumber).toMatch(/^NOC-/);
    expect(stockOf(ctx.db, 'carmesi', 'M')).toBe(before - 2);

    const saved = await request(ctx.app).get(`/api/orders/${res.body.data.orderNumber}`);
    expect(saved.status).toBe(200);
    expect(saved.body.data.items[0]).toMatchObject({ productName: 'Rubí Imperial', size: 'M', quantity: 2, personalization: 'Ana' });
    const email = ctx.db.prepare('SELECT customer_email FROM orders').get().customer_email;
    expect(email).toBe('ana@example.com');
  });

  it('rechaza datos inválidos con 422 y detalles por campo', async () => {
    const res = await request(ctx.app)
      .post('/api/orders')
      .send({ customer: { name: 'A', email: 'no-es-correo' }, items: [] });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const paths = res.body.error.details.map((d) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['customer.name', 'customer.email', 'items']));
  });

  it('rechaza personalizaciones con caracteres no permitidos', async () => {
    const order = validOrder(ctx.db);
    order.items[0].personalization = '<script>';
    const res = await request(ctx.app).post('/api/orders').send(order);
    expect(res.status).toBe(422);
  });

  it('responde 409 sin stock y no guarda nada (transacción)', async () => {
    const order = validOrder(ctx.db, {
      items: [
        { productId: productId(ctx.db, 'carmesi'), size: 'S', quantity: 1 },
        { productId: productId(ctx.db, 'grafito'), size: 'XL', quantity: 1 },
      ],
    });
    const before = stockOf(ctx.db, 'carmesi', 'S');
    const res = await request(ctx.app).post('/api/orders').send(order);
    expect(res.status).toBe(409);
    expect(stockOf(ctx.db, 'carmesi', 'S')).toBe(before);
    expect(ctx.db.prepare('SELECT COUNT(*) AS n FROM orders').get().n).toBe(0);
  });

  it('rechaza una talla que no existe', async () => {
    const order = validOrder(ctx.db);
    order.items[0].size = 'XXXL';
    const res = await request(ctx.app).post('/api/orders').send(order);
    expect(res.status).toBe(422);
    expect(res.body.error.details[0].path).toBe('items.0.size');
  });

  it('responde 400 si el cuerpo no es JSON válido', async () => {
    const res = await request(ctx.app).post('/api/orders').set('Content-Type', 'application/json').send('{malo');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_JSON');
  });
});

describe('rutas desconocidas', () => {
  it('responde 404 en /api para rutas inexistentes', async () => {
    const res = await request(ctx.app).get('/api/nada');
    expect(res.status).toBe(404);
  });
});
