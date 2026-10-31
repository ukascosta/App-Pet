/**
 * Planejamento e aplicação de importações (e de edições unitárias do painel).
 *
 *   1) normalizar  → valores tipados + erros por célula
 *   2) verificar   → referências entre abas/banco, coerência de datas, duplicidades
 *   3) planejar    → criar / atualizar / sem mudança, com o "antes → depois" de cada campo
 *   4) aplicar     → tudo numa transação; se algo falhar, nada é gravado
 *
 * Nunca apaga registros ausentes da planilha: exclusão é sempre uma ação explícita no painel.
 */
import { normalizeRow, same } from '../domain/entities.js';
import { nowIso, todayIn } from '../lib/time.js';

/** Contexto de verificação: enxerga o banco + o que está chegando na própria planilha. */
export function buildContext(db, { settings, targetTripId = null, attachments = [], storage = null, actorId = null, source = 'import', now = Date.now() }) {
  const fileTrips = new Map();
  const fileDestinations = new Map();
  const filePlaces = new Set();
  const attachmentMap = new Map(attachments.map((a) => [a.name.toLowerCase(), a]));
  const tripStmt = db.prepare('SELECT * FROM trips WHERE id = ?');
  const destStmt = db.prepare('SELECT id, parent_id, timezone FROM destinations WHERE id = ?');
  const placeStmt = db.prepare('SELECT id FROM places WHERE id = ?');

  const ctx = {
    settings,
    targetTripId,
    storage,
    actorId,
    source,
    nowIso: nowIso(now),
    today: todayIn('America/Sao_Paulo', now),
    createdFiles: [],
    removedFiles: [],
    fileTrips,
    fileDestinations,
    filePlaces,
    trip(id) {
      const db_ = tripStmt.get(id);
      const f = fileTrips.get(id);
      if (!f) return db_ || null;
      return { ...(db_ || {}), start_date: f.start_date ?? db_?.start_date, end_date: f.end_date ?? db_?.end_date, timezone: f.timezone ?? db_?.timezone };
    },
    destinationExists: (id) => fileDestinations.has(id) || !!destStmt.get(id),
    destinationTimezone(id) {
      if (!id) return null;
      return fileDestinations.get(id)?.timezone || destStmt.get(id)?.timezone || null;
    },
    placeExists: (id) => filePlaces.has(id) || !!placeStmt.get(id),
    /** Ligar `id` a `parentId` criaria um ciclo? Sobe a hierarquia (planilha tem prioridade sobre o banco). */
    wouldCycle(id, parentId) {
      const seen = new Set();
      let cur = parentId;
      while (cur && !seen.has(cur)) {
        if (cur === id) return true;
        seen.add(cur);
        cur = fileDestinations.has(cur) ? fileDestinations.get(cur).parent_id : destStmt.get(cur)?.parent_id;
      }
      return false;
    },
    attachment: (name) => (name ? attachmentMap.get(String(name).toLowerCase()) || null : null),
  };
  return ctx;
}

function registerFileValues(entity, values, ctx) {
  if (entity.sheet === 'TRIPS' && values.trip_id) ctx.fileTrips.set(values.trip_id, values);
  if (entity.sheet === 'DESTINATIONS' && values.destination_id) ctx.fileDestinations.set(values.destination_id, values);
  if (entity.sheet === 'PLACES' && values.content_id) ctx.filePlaces.add(values.content_id);
}

/** Nome amigável (coluna da planilha) para cada campo do banco que mudou. */
function describeChanges(entity, rec, existing) {
  const back = new Map((entity.map || []).map(([sk, col]) => [col, sk]));
  const changes = {};
  for (const col of Object.keys(rec)) {
    if (!same(rec[col], existing[col])) changes[back.get(col) || col] = { from: existing[col] ?? null, to: rec[col] ?? null };
  }
  return changes;
}

const definedOnly = (o) => Object.fromEntries(Object.entries(o).filter(([, x]) => x !== undefined));

/** Planeja uma linha já normalizada. */
export function planRow(entity, db, values, normIssues, ctx) {
  let issues = [...normIssues];
  let existing = null;
  if (!issues.some((i) => i.severity === 'error' && !i.deferred)) {
    existing = ctx.forceExisting || entity.find(db, values, ctx) || null;
    // Atualização: campo obrigatório vazio significa "manter o atual".
    if (existing) issues = issues.filter((i) => !i.deferred);
    if (ctx.forceExisting) {
      const clash = entity.find(db, values, ctx);
      if (clash && clash.id !== ctx.forceExisting.id)
        issues.push({ severity: 'error', column: null, message: 'Já existe outro registro com essa identificação.', hint: 'Use outro número/ID ou edite o registro existente.' });
    }
    if (!issues.some((i) => i.severity === 'error')) {
      // As verificações cruzadas olham o estado final (valor atual + o que mudou).
      const merged = existing ? { ...entity.fromDb(existing), ...definedOnly(values) } : values;
      issues.push(...entity.check(merged, ctx, existing, db, values));
    }
  }
  issues = issues.map(({ deferred, ...i }) => i);
  const hasError = issues.some((i) => i.severity === 'error');
  let action = 'error';
  let changes = {};
  if (!hasError) {
    if (existing) {
      const rec = entity.toDb(values, existing, ctx);
      changes = { ...describeChanges(entity, rec, existing), ...(entity.extraChanges?.(values, existing, ctx) || {}) };
      action = Object.keys(changes).length ? 'update' : 'unchanged';
    } else action = 'create';
  }
  return { action, changes, issues, existingId: existing?.id ?? null };
}

/**
 * Normaliza e planeja todas as abas.
 * input: { [SHEET]: { rows: [{ row, cells }] } }
 * Devolve { sheets: [{ sheet, label, rows: [...], counts }], errorCount, warningCount }.
 */
export function planImport(db, entities, input, ctx) {
  const normalized = [];
  for (const entity of entities) {
    const data = input[entity.sheet];
    if (!data) continue;
    const rows = data.rows.map((r) => {
      const { values, issues } = normalizeRow(entity, r.cells, ctx);
      registerFileValues(entity, values, ctx);
      return { row: r.row, values, normIssues: issues };
    });
    normalized.push({ entity, rows });
  }
  return planNormalized(db, normalized, ctx);
}

/** Planeja a partir de valores já normalizados (usado de novo na confirmação). */
export function planNormalized(db, normalized, ctx) {
  for (const { entity, rows } of normalized) for (const r of rows) registerFileValues(entity, r.values, ctx);
  const sheets = [];
  let errorCount = 0;
  let warningCount = 0;
  for (const { entity, rows } of normalized) {
    const seen = new Map();
    const planned = rows.map((r) => {
      const p = planRow(entity, db, r.values, r.normIssues, ctx);
      const key = p.action === 'error' && r.normIssues.length ? null : entity.rowKey(r.values);
      if (key) {
        if (seen.has(key)) {
          p.issues.push({ severity: 'error', column: null, message: `Linha repetida: mesma chave da linha ${seen.get(key)} (${key}).`, hint: 'Remova a duplicata ou use IDs diferentes.' });
          p.action = 'error';
        } else seen.set(key, r.row);
      }
      for (const i of p.issues) i.severity === 'error' ? errorCount++ : warningCount++;
      return { row: r.row, label: entity.describe(r.values), values: r.values, normIssues: r.normIssues, ...p };
    });
    const counts = { create: 0, update: 0, unchanged: 0, error: 0 };
    for (const p of planned) counts[p.action]++;
    sheets.push({ sheet: entity.sheet, label: entity.label, rows: planned, counts });
  }
  return { sheets, errorCount, warningCount };
}

/**
 * Aplica o plano numa transação única. Arquivos novos gravados durante a transação são
 * removidos se ela falhar; arquivos substituídos só são apagados depois do commit.
 */
export function applyPlan(db, entitiesBySheet, plan, ctx) {
  if (plan.errorCount > 0) throw new Error('Plano com erros não pode ser aplicado.');
  const results = [];
  try {
    db.transaction(() => {
      for (const sheet of plan.sheets) {
        const entity = entitiesBySheet[sheet.sheet];
        for (const row of sheet.rows) {
          if (row.action !== 'create' && row.action !== 'update') continue;
          const result = entity.apply(db, row.values, ctx);
          results.push({ sheet: sheet.sheet, row: row.row, values: row.values, ...result });
        }
      }
    })();
  } catch (e) {
    for (const key of ctx.createdFiles) ctx.storage?.remove(key);
    throw e;
  }
  for (const key of ctx.removedFiles) ctx.storage?.remove(key);
  return results;
}
