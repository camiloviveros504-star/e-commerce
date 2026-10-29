import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transaction } from './connection.js';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

/**
 * Una migración que reconstruye una tabla lleva en su primera línea `-- foreign_keys: off`:
 * SQLite exige desactivar las claves foráneas FUERA de la transacción (si no, borrar la tabla
 * vieja borraría en cascada sus filas hijas). Al terminar se verifica la integridad referencial.
 */
const needsForeignKeysOff = (sql) => /^--\s*foreign_keys:\s*off/i.test(sql.trimStart());

/** Aplica en orden las migraciones .sql que aún no se han ejecutado. */
export function migrate(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')))`);
  const applied = new Set(
    db
      .prepare('SELECT name FROM schema_migrations')
      .all()
      .map((r) => r.name),
  );
  const pending = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql') && !applied.has(f))
    .sort();
  for (const file of pending) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    const fkOff = needsForeignKeysOff(sql);
    if (fkOff) db.exec('PRAGMA foreign_keys = OFF;');
    try {
      transaction(db, () => {
        db.exec(sql);
        if (fkOff) {
          const broken = db.prepare('PRAGMA foreign_key_check').all();
          if (broken.length) throw new Error(`La migración ${file} rompe ${broken.length} referencias`);
        }
        db.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run(file);
      });
    } finally {
      if (fkOff) db.exec('PRAGMA foreign_keys = ON;');
    }
  }
  return pending;
}
