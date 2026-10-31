// Repositório em memória: usado pela pré-visualização (no navegador) e pelos testes de regra.
// `state` é um objeto simples com um array por tabela e um objeto `settings`.

export function memoryRepo(state) {
  state.seq ??= {};
  state.settings ??= {};
  const rows = (table) => (state[table] ??= []);
  const clone = (r) => (r ? structuredClone(r) : r);
  const matches = (row, where) => Object.entries(where).every(([k, v]) => row[k] === v || (typeof v === 'boolean' && row[k] === (v ? 1 : 0)));
  const nextId = (table) => {
    const max = rows(table).reduce((m, r) => Math.max(m, r.id), 0);
    state.seq[table] = Math.max(state.seq[table] ?? 0, max) + 1;
    return state.seq[table];
  };
  const norm = (data) => Object.fromEntries(Object.entries(data).map(([k, v]) => [k, typeof v === 'boolean' ? (v ? 1 : 0) : v]));

  return {
    all: (table, where = {}) => rows(table).filter((r) => matches(r, where)).sort((a, b) => a.id - b.id).map(clone),
    get: (table, id) => clone(rows(table).find((r) => r.id === id)),
    insert(table, data) {
      const row = { id: nextId(table), ...norm(data) };
      rows(table).push(row);
      return clone(row);
    },
    update(table, id, patch) {
      const row = rows(table).find((r) => r.id === id);
      if (row) Object.assign(row, norm(patch));
      return clone(row);
    },
    remove(table, id) {
      state[table] = rows(table).filter((r) => r.id !== id);
    },
    setting: (key) => clone(state.settings[key]),
    setSetting(key, value) {
      state.settings[key] = clone(value);
    },
    transaction: (fn) => fn(),
  };
}
