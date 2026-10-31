import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

/**
 * Esquema do banco. Cada item do array é uma migração; a posição + 1 vira o user_version.
 * Nunca edite uma migração já publicada: acrescente outra no fim.
 */
const MIGRATIONS = [
  `
  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    updated_by TEXT
  );

  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL DEFAULT '',
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'traveler' CHECK (role IN ('traveler','editor','admin')),
    nationality TEXT,
    preferences TEXT NOT NULL DEFAULT '{}',
    notification_prefs TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_login_at TEXT,
    disabled_at TEXT
  );

  CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    last_seen_at TEXT
  );

  CREATE TABLE login_codes (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL COLLATE NOCASE,
    code_hash TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT
  );
  CREATE INDEX login_codes_email ON login_codes(email, created_at);

  -- Biblioteca de destinos: país, região, cidade ou bairro. parent_id forma a hierarquia.
  CREATE TABLE destinations (
    id TEXT PRIMARY KEY,
    parent_id TEXT REFERENCES destinations(id) ON DELETE SET NULL,
    country TEXT NOT NULL,
    region TEXT,
    city TEXT,
    neighborhood TEXT,
    language TEXT,
    overview TEXT,
    best_season TEXT,
    timezone TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE trips (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    destination_id TEXT NOT NULL REFERENCES destinations(id),
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    timezone TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived','canceled')),
    trip_type TEXT,
    language TEXT,
    cover_image_url TEXT,
    general_notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE trip_travelers (
    id TEXT PRIMARY KEY,
    trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    traveler_role TEXT NOT NULL DEFAULT 'acompanhante',
    invitation_status TEXT NOT NULL DEFAULT 'not_sent'
      CHECK (invitation_status IN ('not_sent','sent','accepted','revoked')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (trip_id, user_id)
  );

  CREATE TABLE invites (
    id TEXT PRIMARY KEY,
    trip_traveler_id TEXT NOT NULL REFERENCES trip_travelers(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    created_by TEXT,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    revoked_at TEXT
  );

  CREATE TABLE flight_segments (
    id TEXT PRIMARY KEY,
    trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    segment_order INTEGER NOT NULL,
    airline TEXT NOT NULL,
    flight_number TEXT NOT NULL,
    departure_airport TEXT NOT NULL,
    departure_at TEXT NOT NULL,
    arrival_airport TEXT NOT NULL,
    arrival_at TEXT NOT NULL,
    booking_reference TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (trip_id, segment_order)
  );

  CREATE TABLE accommodations (
    id TEXT PRIMARY KEY,
    external_id TEXT NOT NULL,
    trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    city_id TEXT REFERENCES destinations(id),
    name TEXT NOT NULL,
    checkin_at TEXT NOT NULL,
    checkout_at TEXT NOT NULL,
    address TEXT,
    latitude REAL,
    longitude REAL,
    confirmation_code TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (trip_id, external_id)
  );

  CREATE TABLE itinerary_items (
    id TEXT PRIMARY KEY,
    external_id TEXT NOT NULL,
    trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    start_time TEXT,
    end_time TEXT,
    city_id TEXT REFERENCES destinations(id),
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    address TEXT,
    description TEXT,
    booking_status TEXT,
    confirmation_code TEXT,
    external_url TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (trip_id, external_id)
  );

  CREATE TABLE documents (
    id TEXT PRIMARY KEY,
    external_id TEXT NOT NULL,
    trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    stage TEXT,
    source_name TEXT,
    storage_key TEXT,
    external_url TEXT,
    mime_type TEXT,
    size_bytes INTEGER,
    sha256 TEXT,
    visible_to_traveler INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    uploaded_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (trip_id, external_id)
  );

  CREATE TABLE document_versions (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    storage_key TEXT,
    external_url TEXT,
    file_name TEXT,
    mime_type TEXT,
    size_bytes INTEGER,
    sha256 TEXT,
    uploaded_by TEXT,
    created_at TEXT NOT NULL
  );

  -- Regras da jornada de preparação (configuráveis no painel).
  CREATE TABLE checklist_rules (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    days_before INTEGER,
    priority TEXT NOT NULL DEFAULT 'media',
    official_url TEXT,
    conditions TEXT NOT NULL DEFAULT '{}',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    external_id TEXT,
    trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    rule_id TEXT REFERENCES checklist_rules(id) ON DELETE SET NULL,
    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('rule','manual','import')),
    title TEXT NOT NULL,
    description TEXT,
    due_date TEXT,
    priority TEXT NOT NULL DEFAULT 'media',
    source_rule TEXT,
    official_url TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE UNIQUE INDEX tasks_rule ON tasks(trip_id, rule_id) WHERE rule_id IS NOT NULL;
  CREATE UNIQUE INDEX tasks_external ON tasks(trip_id, external_id) WHERE external_id IS NOT NULL;

  -- Conclusão é por viajante: "passaporte em dia" é pessoal.
  CREATE TABLE task_completions (
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    completed_at TEXT NOT NULL,
    PRIMARY KEY (task_id, user_id)
  );

  CREATE TABLE places (
    id TEXT PRIMARY KEY,
    destination_id TEXT NOT NULL REFERENCES destinations(id),
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    short_description TEXT,
    address TEXT,
    latitude REAL,
    longitude REAL,
    price_level TEXT,
    official_url TEXT,
    booking_url TEXT,
    opening_hours TEXT,
    tags TEXT NOT NULL DEFAULT '[]',
    source_url TEXT,
    last_verified_at TEXT,
    verification_notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending_review'
      CHECK (status IN ('pending_review','approved','archived')),
    reviewed_by TEXT,
    reviewed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX places_destination ON places(destination_id, status);

  CREATE TABLE place_media (
    id TEXT PRIMARY KEY,
    place_id TEXT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    display_order INTEGER NOT NULL,
    media_url TEXT,
    storage_key TEXT,
    source_name TEXT,
    sha256 TEXT,
    alt_text TEXT NOT NULL,
    rights_notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (place_id, display_order)
  );

  -- Destaques que a Vagari associa a uma viagem específica.
  CREATE TABLE trip_places (
    trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    place_id TEXT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    note TEXT,
    created_at TEXT NOT NULL,
    PRIMARY KEY (trip_id, place_id)
  );

  CREATE TABLE favorites (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    place_id TEXT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    UNIQUE (user_id, place_id)
  );

  CREATE TABLE announcements (
    id TEXT PRIMARY KEY,
    trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    essential INTEGER NOT NULL DEFAULT 0,
    created_by TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trip_id TEXT REFERENCES trips(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    link TEXT,
    essential INTEGER NOT NULL DEFAULT 0,
    dedupe_key TEXT UNIQUE,
    email_status TEXT NOT NULL DEFAULT 'skip' CHECK (email_status IN ('skip','pending','sent','failed')),
    read_at TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX notifications_user ON notifications(user_id, created_at);

  CREATE TABLE import_jobs (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('trip','content')),
    file_names TEXT NOT NULL,
    uploaded_by TEXT NOT NULL,
    target_trip_id TEXT,
    status TEXT NOT NULL CHECK (status IN ('preview','completed','failed','canceled')),
    parsed TEXT,
    attachments TEXT NOT NULL DEFAULT '[]',
    preview TEXT,
    summary TEXT,
    error_count INTEGER NOT NULL DEFAULT 0,
    warning_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    completed_at TEXT
  );

  CREATE TABLE audit_log (
    id TEXT PRIMARY KEY,
    actor_id TEXT,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    trip_id TEXT,
    action TEXT NOT NULL,
    before_json TEXT,
    after_json TEXT,
    source TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX audit_entity ON audit_log(entity_type, entity_id);
  CREATE INDEX audit_trip ON audit_log(trip_id, created_at);

  -- Eventos de uso para as métricas do MVP (sem conteúdo pessoal).
  CREATE TABLE usage_events (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    trip_id TEXT,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX usage_events_name ON usage_events(name, created_at);

  -- Pedidos do titular (LGPD): acesso, correção, exclusão.
  CREATE TABLE privacy_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    message TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL,
    resolved_at TEXT
  );
  `,
];

export function openDatabase(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  migrate(db);
  return db;
}

function migrate(db) {
  const current = db.pragma('user_version', { simple: true });
  for (let i = current; i < MIGRATIONS.length; i++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[i]);
      db.pragma(`user_version = ${i + 1}`);
    })();
  }
}
