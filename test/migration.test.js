import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import Database from 'better-sqlite3';
import { openDatabase } from '../server/db.js';

test('banco da versão anterior é migrado sem perder cadastros e pets', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'petlee-'));
  const file = path.join(dir, 'old.db');

  // Esquema da v1 (WhatsApp e aceite obrigatórios, sem senha, sem rotina de refeições).
  const old = new Database(file);
  old.exec(`
    CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      whatsapp TEXT NOT NULL UNIQUE, consent_at INTEGER NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE, created_at INTEGER NOT NULL);
    CREATE TABLE pets (id INTEGER PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      name TEXT NOT NULL, species TEXT NOT NULL, breed_id TEXT NOT NULL, breed_name TEXT NOT NULL, adult_kg REAL NOT NULL, color TEXT NOT NULL,
      birth_at INTEGER NOT NULL, weight_kg REAL, neutered INTEGER NOT NULL DEFAULT 1, kcal_per_kg INTEGER, monthly_purchase_g INTEGER NOT NULL,
      daily_mode TEXT NOT NULL, daily_g REAL NOT NULL, stock_g REAL NOT NULL, stock_at INTEGER NOT NULL, alert_days INTEGER NOT NULL DEFAULT 7,
      alert_state TEXT NOT NULL DEFAULT 'ok', created_at INTEGER NOT NULL);
    INSERT INTO customers VALUES (1, 'Maria', 'maria@example.com', '5511999998888', 1000, 1000);
    INSERT INTO sessions VALUES ('abc', 1, 1000);
    INSERT INTO pets (id, customer_id, name, species, breed_id, breed_name, adult_kg, color, birth_at, monthly_purchase_g, daily_mode, daily_g, stock_g, stock_at, created_at)
      VALUES (1, 1, 'Thor', 'dog', 'labrador', 'Labrador Retriever', 30.5, 'Caramelo', 0, 10000, 'recommended', 380, 10000, 1000, 1000);
  `);
  old.close();

  const db = openDatabase(file);
  try {
    assert.equal(db.pragma('user_version', { simple: true }), 2);
    assert.deepEqual(db.prepare('SELECT name, email, whatsapp, password_hash, google_id FROM customers').get(), {
      name: 'Maria', email: 'maria@example.com', whatsapp: '5511999998888', password_hash: null, google_id: null,
    });
    const pet = db.prepare('SELECT name, meals_per_day, meal_times FROM pets').get();
    assert.deepEqual(pet, { name: 'Thor', meals_per_day: 2, meal_times: null });
    assert.equal(db.prepare('SELECT COUNT(*) n FROM sessions').get().n, 1);

    // agora quem entra por Google pode existir sem WhatsApp, e a exclusão em cascata continua valendo
    db.prepare("INSERT INTO customers (name, email, google_id, created_at) VALUES ('Ana', 'ana@example.com', 'g1', 1)").run();
    assert.equal(db.pragma('foreign_key_check').length, 0);
    db.prepare('DELETE FROM customers WHERE id = 1').run();
    assert.equal(db.prepare('SELECT COUNT(*) n FROM pets').get().n, 0);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM sessions').get().n, 0);
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }

  // abrir de novo não migra outra vez
  const db2 = openDatabase(path.join(os.tmpdir(), `petlee-${process.pid}.db`));
  assert.equal(db2.pragma('user_version', { simple: true }), 2);
  db2.close();
  fs.rmSync(path.join(os.tmpdir(), `petlee-${process.pid}.db`), { force: true });
});
