import { rmSync } from 'node:fs';
import { config } from '../config/env.js';
import { openDatabase } from './connection.js';
import { migrate } from './migrate.js';
import { seed } from './seed.js';

const command = process.argv[2];

if (command === 'reset') {
  for (const suffix of ['', '-wal', '-shm']) rmSync(config.dbPath + suffix, { force: true });
}
const db = openDatabase(config.dbPath);
const applied = migrate(db);
console.log(`Migraciones aplicadas: ${applied.length ? applied.join(', ') : 'ninguna pendiente'}`);
if (command === 'seed' || command === 'reset') {
  seed(db);
  console.log('Datos iniciales cargados.');
}
db.close();
