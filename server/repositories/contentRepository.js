export function createContentRepository(db) {
  return {
    getAll() {
      return Object.fromEntries(db.prepare('SELECT key, value FROM site_content').all().map((r) => [r.key, r.value]));
    },
    get(key) {
      return db.prepare('SELECT value FROM site_content WHERE key = ?').get(key)?.value;
    },
  };
}
