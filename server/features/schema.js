// Tabelas dos módulos comerciais (clube, vitrine, pedidos, pontos, agenda, campanhas).
// A mesma definição cria as tabelas no SQLite e orienta o repositório em memória da pré-visualização.
// Tipo JSON = texto no SQLite, objeto/array no código.

export const TABLES = {
  products: {
    name: 'TEXT NOT NULL', description: 'TEXT', category: 'TEXT NOT NULL', species: "TEXT NOT NULL DEFAULT 'all'",
    tags: 'JSON', icon: 'TEXT', price_cents: 'INTEGER NOT NULL', stock: 'INTEGER', weight_kg: 'REAL', cycle_days: 'INTEGER',
    club_discount: 'INTEGER NOT NULL DEFAULT 1', members_only: 'INTEGER NOT NULL DEFAULT 0', featured: 'INTEGER NOT NULL DEFAULT 0',
    is_new: 'INTEGER NOT NULL DEFAULT 0', points_multiplier: 'REAL NOT NULL DEFAULT 1', active: 'INTEGER NOT NULL DEFAULT 1', created_at: 'INTEGER NOT NULL',
  },
  orders: {
    customer_id: 'INTEGER NOT NULL', pet_id: 'INTEGER', source: 'TEXT NOT NULL', status: 'TEXT NOT NULL', items: 'JSON NOT NULL',
    subtotal_cents: 'INTEGER NOT NULL', discount_cents: 'INTEGER NOT NULL DEFAULT 0', shipping_cents: 'INTEGER NOT NULL DEFAULT 0',
    total_cents: 'INTEGER NOT NULL', points_used: 'INTEGER NOT NULL DEFAULT 0', points_earned: 'INTEGER NOT NULL DEFAULT 0',
    coupon_code: 'TEXT', delivery: "TEXT NOT NULL DEFAULT 'retirada'", note: 'TEXT', created_at: 'INTEGER NOT NULL', confirmed_at: 'INTEGER',
  },
  club_subscriptions: {
    customer_id: 'INTEGER NOT NULL', status: 'TEXT NOT NULL', price_cents: 'INTEGER NOT NULL', started_at: 'INTEGER', renews_at: 'INTEGER',
    cancelled_at: 'INTEGER', created_at: 'INTEGER NOT NULL',
  },
  points: { customer_id: 'INTEGER NOT NULL', delta: 'INTEGER NOT NULL', reason: 'TEXT NOT NULL', order_id: 'INTEGER', expires_at: 'INTEGER', created_at: 'INTEGER NOT NULL' },
  rewards: { name: 'TEXT NOT NULL', cost_points: 'INTEGER NOT NULL', kind: 'TEXT NOT NULL', value_cents: 'INTEGER NOT NULL DEFAULT 0', active: 'INTEGER NOT NULL DEFAULT 1' },
  redemptions: { customer_id: 'INTEGER NOT NULL', reward_id: 'INTEGER NOT NULL', name: 'TEXT NOT NULL', code: 'TEXT NOT NULL', status: 'TEXT NOT NULL', created_at: 'INTEGER NOT NULL', used_at: 'INTEGER' },
  referrals: { referrer_id: 'INTEGER NOT NULL', referred_id: 'INTEGER NOT NULL', status: 'TEXT NOT NULL', created_at: 'INTEGER NOT NULL' },
  care: {
    customer_id: 'INTEGER NOT NULL', pet_id: 'INTEGER NOT NULL', kind: 'TEXT NOT NULL', title: 'TEXT NOT NULL', due_at: 'INTEGER NOT NULL',
    repeat_days: 'INTEGER', done_at: 'INTEGER', source: "TEXT NOT NULL DEFAULT 'tutor'", notes: 'TEXT', notified_at: 'INTEGER', created_at: 'INTEGER NOT NULL',
  },
  slots: { service: 'TEXT NOT NULL', starts_at: 'INTEGER NOT NULL', minutes: 'INTEGER NOT NULL', price_cents: 'INTEGER NOT NULL', appointment_id: 'INTEGER' },
  appointments: {
    slot_id: 'INTEGER NOT NULL', customer_id: 'INTEGER NOT NULL', pet_id: 'INTEGER NOT NULL', service: 'TEXT NOT NULL', starts_at: 'INTEGER NOT NULL',
    price_cents: 'INTEGER NOT NULL', discount_cents: 'INTEGER NOT NULL DEFAULT 0', status: 'TEXT NOT NULL', created_at: 'INTEGER NOT NULL',
  },
  campaigns: {
    name: 'TEXT NOT NULL', kind: 'TEXT NOT NULL', category: 'TEXT', product_id: 'INTEGER', multiplier: 'REAL NOT NULL DEFAULT 2',
    starts_at: 'INTEGER', ends_at: 'INTEGER', active: 'INTEGER NOT NULL DEFAULT 1', created_at: 'INTEGER NOT NULL',
  },
  coupons: {
    code: 'TEXT NOT NULL', description: 'TEXT', percent: 'INTEGER NOT NULL DEFAULT 0', value_cents: 'INTEGER NOT NULL DEFAULT 0',
    min_cents: 'INTEGER NOT NULL DEFAULT 0', members_only: 'INTEGER NOT NULL DEFAULT 0', ends_at: 'INTEGER', max_uses: 'INTEGER',
    uses: 'INTEGER NOT NULL DEFAULT 0', active: 'INTEGER NOT NULL DEFAULT 1', created_at: 'INTEGER NOT NULL',
  },
  opportunity_actions: { key: 'TEXT NOT NULL', status: 'TEXT NOT NULL', note: "TEXT NOT NULL DEFAULT ''", updated_at: 'INTEGER NOT NULL' },
  broadcasts: { title: 'TEXT NOT NULL', body: 'TEXT NOT NULL', segment: 'JSON NOT NULL', sent_count: 'INTEGER NOT NULL', created_at: 'INTEGER NOT NULL' },
};

// Tabelas antigas que os módulos também leem/escrevem (sem colunas JSON).
export const LEGACY_TABLES = ['customers', 'pets', 'alerts', 'leads'];

export const jsonColumns = (table) =>
  Object.entries(TABLES[table] ?? {}).filter(([, type]) => type.startsWith('JSON')).map(([col]) => col);

export function ddl() {
  return Object.entries(TABLES)
    .map(([table, cols]) => {
      const body = Object.entries(cols).map(([col, type]) => `  ${col} ${type.replace(/^JSON/, 'TEXT')}`).join(',\n');
      return `CREATE TABLE IF NOT EXISTS ${table} (\n  id INTEGER PRIMARY KEY,\n${body}\n);`;
    })
    .concat([
      'CREATE INDEX IF NOT EXISTS orders_customer ON orders(customer_id, created_at);',
      'CREATE INDEX IF NOT EXISTS points_customer ON points(customer_id);',
      'CREATE INDEX IF NOT EXISTS care_customer ON care(customer_id, due_at);',
      'CREATE INDEX IF NOT EXISTS slots_time ON slots(starts_at);',
      'CREATE UNIQUE INDEX IF NOT EXISTS opportunity_key ON opportunity_actions(key);',
      'CREATE UNIQUE INDEX IF NOT EXISTS coupon_code ON coupons(code);',
    ])
    .join('\n');
}
