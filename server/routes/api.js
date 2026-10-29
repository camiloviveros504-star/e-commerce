import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { createCatalogController } from '../controllers/catalogController.js';
import { createOrderController } from '../controllers/orderController.js';

export function createApiRouter({ catalogService, orderService, orderRateLimit = 30 }) {
  const router = Router();
  const catalog = createCatalogController(catalogService);
  const orders = createOrderController(orderService);
  const ordersLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: orderRateLimit, standardHeaders: 'draft-7', legacyHeaders: false });

  router.get('/health', (_req, res) => res.json({ data: { status: 'ok' } }));
  router.get('/products', catalog.listProducts);
  router.get('/products/:slug', catalog.getProduct);
  router.get('/categories', catalog.listCategories);
  router.get('/content', catalog.getContent);
  router.post('/orders', ordersLimiter, orders.create);
  router.get('/orders/:orderNumber', orders.getByNumber);
  return router;
}
