import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS customers (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE COLLATE NOCASE,
  whatsapp    TEXT NOT NULL UNIQUE,
  consent_at  INTEGER NOT NULL,      -- aceite para a loja entrar em contato (LGPD)
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,      -- sha256 do token; o token em si só existe no aparelho
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS pets (
  id                 INTEGER PRIMARY KEY,
  customer_id        INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  species            TEXT NOT NULL CHECK (species IN ('dog','cat')),
  breed_id           TEXT NOT NULL,
  breed_name         TEXT NOT NULL,
  adult_kg           REAL NOT NULL,   -- peso adulto típico (da raça ou informado pelo tutor)
  color              TEXT NOT NULL,
  birth_at           INTEGER NOT NULL, -- data de nascimento estimada a partir da idade informada
  weight_kg          REAL,
  neutered           INTEGER NOT NULL DEFAULT 1,
  kcal_per_kg        INTEGER,
  monthly_purchase_g INTEGER NOT NULL,
  daily_mode         TEXT NOT NULL CHECK (daily_mode IN ('recommended','purchase','custom')),
  daily_g            REAL NOT NULL,   -- consumo diário usado na contagem regressiva
  stock_g            REAL NOT NULL,   -- estoque medido em stock_at
  stock_at           INTEGER NOT NULL,
  alert_days         INTEGER NOT NULL DEFAULT 7,
  alert_state        TEXT NOT NULL DEFAULT 'ok' CHECK (alert_state IN ('ok','low','empty')),
  created_at         INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS pets_customer ON pets(customer_id);

-- Pedidos de reposição que a loja deve atender.
CREATE TABLE IF NOT EXISTS leads (
  id           INTEGER PRIMARY KEY,
  customer_id  INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  pet_id       INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN ('low','empty')),
  status       TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','sold','closed')),
  days_left    REAL NOT NULL,
  suggested_kg REAL NOT NULL,
  note         TEXT NOT NULL DEFAULT '',
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS leads_status ON leads(status, created_at);

-- Avisos que o tutor vê dentro do app.
CREATE TABLE IF NOT EXISTS alerts (
  id          INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  pet_id      INTEGER REFERENCES pets(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  read_at     INTEGER
);
CREATE INDEX IF NOT EXISTS alerts_customer ON alerts(customer_id, created_at);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);

-- Fila de envios (WhatsApp da loja, push e e-mail do tutor) com nova tentativa em caso de falha.
CREATE TABLE IF NOT EXISTS outbox (
  id              INTEGER PRIMARY KEY,
  channel         TEXT NOT NULL CHECK (channel IN ('store_whatsapp','customer_push','customer_email')),
  customer_id     INTEGER REFERENCES customers(id) ON DELETE CASCADE,
  lead_id         INTEGER REFERENCES leads(id) ON DELETE CASCADE,
  payload         TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','skipped','failed')),
  attempts        INTEGER NOT NULL DEFAULT 0,
  last_error      TEXT,
  next_attempt_at INTEGER NOT NULL,
  created_at      INTEGER NOT NULL,
  sent_at         INTEGER
);
CREATE INDEX IF NOT EXISTS outbox_pending ON outbox(status, next_attempt_at);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

export function openDatabase(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}

export const getSetting = (db, key) => db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value;
export const setSetting = (db, key, value) =>
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
