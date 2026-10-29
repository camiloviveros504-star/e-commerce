import { config } from './config/env.js';
import { openDatabase } from './db/connection.js';
import { migrate } from './db/migrate.js';
import { seed } from './db/seed.js';
import { createApp } from './app.js';

const db = openDatabase(config.dbPath);
migrate(db);

// Primera ejecución: si la BD está vacía, se cargan los datos iniciales automáticamente.
const { count } = db.prepare('SELECT COUNT(*) AS count FROM products').get();
if (count === 0) seed(db);

const app = createApp({ db, corsOrigin: config.corsOrigin });
app.listen(config.port, () => {
  console.log(JSON.stringify({ level: 'info', message: `API lista en http://localhost:${config.port}` }));
});
