import express from 'express';
import helmet from 'helmet';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProductRepository } from './repositories/productRepository.js';
import { createContentRepository } from './repositories/contentRepository.js';
import { createOrderRepository } from './repositories/orderRepository.js';
import { createCatalogService } from './services/catalogService.js';
import { createOrderService } from './services/orderService.js';
import { createApiRouter } from './routes/api.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';

const DIST_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');

/** Ensambla la app con sus dependencias (inyectadas para poder probarla con una BD en memoria). */
export function createApp({ db, corsOrigin = '', orderRateLimit } = {}) {
  const productRepository = createProductRepository(db);
  const contentRepository = createContentRepository(db);
  const orderRepository = createOrderRepository(db);
  const catalogService = createCatalogService({ productRepository, contentRepository });
  const orderService = createOrderService({ db, productRepository, orderRepository, contentRepository });

  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: { directives: { 'img-src': ["'self'", 'data:', 'blob:'] } } }));
  app.use(express.json({ limit: '20kb' }));
  if (corsOrigin) {
    app.use('/api', (req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', corsOrigin);
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      if (req.method === 'OPTIONS') return res.sendStatus(204);
      return next();
    });
  }

  app.use('/api', createApiRouter({ catalogService, orderService, orderRateLimit }));
  app.use('/api', notFoundHandler);

  // En producción el servidor también entrega el frontend compilado (SPA).
  if (existsSync(DIST_DIR)) {
    app.use(express.static(DIST_DIR, { maxAge: '1h', index: false }));
    app.get('*', (_req, res) => res.sendFile(join(DIST_DIR, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
