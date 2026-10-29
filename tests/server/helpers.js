import { openDatabase } from '../../server/db/connection.js';
import { migrate } from '../../server/db/migrate.js';
import { seed } from '../../server/db/seed.js';
import { createApp } from '../../server/app.js';

/** BD SQLite en memoria, migrada y con datos iniciales: aislada por prueba. */
export function createTestContext() {
  const db = openDatabase(':memory:');
  migrate(db);
  seed(db);
  const app = createApp({ db, orderRateLimit: 1000 });
  return { db, app };
}
