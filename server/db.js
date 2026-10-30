import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS customers (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  whatsapp      TEXT UNIQUE,          -- vazio só para quem entrou com Google/Facebook e ainda não completou o cadastro
  consent_at    INTEGER,              -- aceite para a loja entrar em contato (LGPD)
  password_hash TEXT,                 -- vazio para quem só usa login social
  email_verified_at INTEGER,          -- quando o e-mail foi comprovado (login social ou link de redefinição)
  google_id     TEXT UNIQUE,
  facebook_id   TEXT UNIQUE,
  created_at    INTEGER NOT NULL
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
  meals_per_day      INTEGER NOT NULL DEFAULT 2,
  meal_times         TEXT,            -- JSON: ["07:30","18:30"]; vazio = horários sugeridos
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

-- Códigos de uso único: redefinição de senha, "state" do login social e código de troca do login social.
CREATE TABLE IF NOT EXISTS auth_tokens (
  token_hash  TEXT PRIMARY KEY,
  kind        TEXT NOT NULL CHECK (kind IN ('reset','oauth_state','oauth_code')),
  customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
  data        TEXT,
  expires_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

const SCHEMA_VERSION = 2;

/** v1 -> v2: login por senha/social (WhatsApp e aceite deixam de ser obrigatórios) e rotina de refeições. */
function migrateV1(db) {
  db.pragma('foreign_keys = OFF');
  db.transaction(() => {
    db.exec(`
      CREATE TABLE customers_v2 (
        id            INTEGER PRIMARY KEY,
        name          TEXT NOT NULL,
        email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
        whatsapp      TEXT UNIQUE,
        consent_at    INTEGER,
        password_hash TEXT,
        email_verified_at INTEGER,
        google_id     TEXT UNIQUE,
        facebook_id   TEXT UNIQUE,
        created_at    INTEGER NOT NULL
      );
      INSERT INTO customers_v2 (id, name, email, whatsapp, consent_at, created_at)
        SELECT id, name, email, whatsapp, consent_at, created_at FROM customers;
      DROP TABLE customers;
      ALTER TABLE customers_v2 RENAME TO customers;
      ALTER TABLE pets ADD COLUMN meals_per_day INTEGER NOT NULL DEFAULT 2;
      ALTER TABLE pets ADD COLUMN meal_times TEXT;
    `);
  })();
  db.pragma('foreign_keys = ON');
}

export function openDatabase(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');

  const version = db.pragma('user_version', { simple: true });
  const existing = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'customers'").get();
  // Banco da versão anterior (sem user_version): migra os dados antes de criar o restante.
  if (existing && version < 2) migrateV1(db);

  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  db.pragma(`user_version = ${SCHEMA_VERSION}`);
  return db;
}

export const getSetting = (db, key) => db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value;
export const setSetting = (db, key, value) =>
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
