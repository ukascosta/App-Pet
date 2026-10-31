// Popula o banco com a loja de demonstração (catálogo, clientes, pedidos, clube, agenda).
// Uso: npm run seed   (só em um banco vazio; não mexe em dados reais)

import { loadConfig } from './config.js';
import { openDatabase } from './db.js';
import { seedCustomers, seedDemoTutor, seedStore } from './features/demo.js';
import { sqliteRepo } from './features/repo-sqlite.js';
import { hashPassword } from './lib/password.js';

const config = loadConfig();
const db = openDatabase(config.dbPath);
const repo = sqliteRepo(db);
if (repo.all('customers').length || repo.all('products').length) {
  console.log('O banco já tem dados. A demonstração só é criada em um banco vazio.');
  process.exit(0);
}
const now = Date.now();
repo.transaction(() => {
  seedStore(repo, now);
  seedCustomers(repo, now);
});
// conta para entrar no app: maria@example.com / senha12345
const { lastInsertRowid } = db.prepare('INSERT INTO customers (name, email, whatsapp, consent_at, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)')
  .run('Maria Silva', 'maria@example.com', '5511999998888', now - 60 * 86_400_000, await hashPassword('senha12345'), now - 60 * 86_400_000);
repo.transaction(() => seedDemoTutor(repo, Number(lastInsertRowid), now));
console.log(`Demonstração criada em ${config.dbPath}: ${repo.all('products').length} produtos, ${repo.all('customers').length} clientes, ${repo.all('orders').length} pedidos.`);
db.close();
