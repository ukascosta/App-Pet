// Repositório sobre o SQLite: o mesmo contrato do repositório em memória (repo-memory.js).
// all(table, where) / get(table, id) / insert / update / remove / setting / setSetting.

import { LEGACY_TABLES, TABLES, jsonColumns } from './schema.js';

const ALLOWED = new Set([...Object.keys(TABLES), ...LEGACY_TABLES]);
const IDENT = /^[a-z_]+$/;

export function sqliteRepo(db) {
  const check = (table) => {
    if (!ALLOWED.has(table)) throw new Error(`tabela desconhecida: ${table}`);
  };
  const decode = (table, row) => {
    if (!row) return row;
    for (const col of jsonColumns(table)) if (typeof row[col] === 'string') row[col] = JSON.parse(row[col]);
    return row;
  };
  const encode = (table, data) => {
    const out = { ...data };
    for (const col of jsonColumns(table)) if (col in out && out[col] !== null) out[col] = JSON.stringify(out[col]);
    for (const [k, v] of Object.entries(out)) if (typeof v === 'boolean') out[k] = v ? 1 : 0;
    return out;
  };
  const keys = (obj) => Object.keys(obj).filter((k) => {
    if (!IDENT.test(k)) throw new Error(`coluna inválida: ${k}`);
    return true;
  });

  return {
    all(table, where = {}) {
      check(table);
      const cols = keys(where);
      const sql = `SELECT * FROM ${table}${cols.length ? ` WHERE ${cols.map((c) => `${c} = @${c}`).join(' AND ')}` : ''} ORDER BY id`;
      return db.prepare(sql).all(encode(table, where)).map((r) => decode(table, r));
    },
    get(table, id) {
      check(table);
      return decode(table, db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id));
    },
    insert(table, data) {
      check(table);
      const row = encode(table, data);
      const cols = keys(row);
      const { lastInsertRowid } = db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map((c) => `@${c}`).join(', ')})`).run(row);
      return this.get(table, Number(lastInsertRowid));
    },
    update(table, id, patch) {
      check(table);
      const row = encode(table, patch);
      const cols = keys(row);
      if (cols.length) db.prepare(`UPDATE ${table} SET ${cols.map((c) => `${c} = @${c}`).join(', ')} WHERE id = @__id`).run({ ...row, __id: id });
      return this.get(table, id);
    },
    remove(table, id) {
      check(table);
      db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
    },
    setting(key) {
      const v = db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value;
      return v === undefined ? undefined : JSON.parse(v);
    },
    setSetting(key, value) {
      db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, JSON.stringify(value));
    },
    transaction: (fn) => db.transaction(fn)(),
  };
}
