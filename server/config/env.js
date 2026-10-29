import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/** Carga un .env simple (clave=valor) sin dependencias externas. */
function loadDotEnv(path = resolve(process.cwd(), '.env')) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2];
  }
}

loadDotEnv();

export const config = Object.freeze({
  port: Number(process.env.API_PORT ?? 3001),
  dbPath: process.env.DB_PATH ?? './data/store.db',
  corsOrigin: process.env.CORS_ORIGIN ?? '',
  isProduction: process.env.NODE_ENV === 'production',
});
