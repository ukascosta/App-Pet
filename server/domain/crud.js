/**
 * Gravação unitária pelo painel, usando exatamente as mesmas regras da importação.
 */
import { normalizeRow } from './entities.js';
import { buildContext, planRow } from '../import/engine.js';
import { applyEffects } from './effects.js';

export class ValidationError extends Error {
  constructor(issues) {
    super('Dados inválidos');
    this.status = 422;
    this.issues = issues;
  }
}

/**
 * cells: valores no formato das colunas da planilha.
 * existing: linha atual (para edição); a chave estável não pode colidir com outro registro.
 * Devolve { result, warnings }. Lança ValidationError com os problemas por campo.
 */
export function saveEntity(services, entity, cells, { existing = null, attachments = [], actorId, notify = false } = {}) {
  const { db, settings, storage } = services;
  const ctx = buildContext(db, { settings: settings.all(), attachments, storage, actorId, source: 'panel', now: services.now?.() });
  if (existing) ctx.forceExisting = existing;
  const merged = existing ? { ...entity.fromDb(existing), ...cells } : cells;
  const { values, issues } = normalizeRow(entity, merged, ctx);
  const plan = planRow(entity, db, values, issues, ctx);
  const errors = plan.issues.filter((i) => i.severity === 'error');
  if (errors.length) throw new ValidationError(plan.issues);
  if (!existing && plan.action !== 'create') {
    throw new ValidationError([{ severity: 'error', column: null, message: 'Já existe um registro com essa identificação.', hint: 'Edite o registro existente ou use outro ID.' }]);
  }
  let result;
  try {
    result = db.transaction(() => entity.apply(db, values, ctx))();
  } catch (e) {
    for (const key of ctx.createdFiles) storage?.remove(key);
    throw e;
  }
  for (const key of ctx.removedFiles) storage?.remove(key);
  applyEffects(services, [{ sheet: entity.sheet, values, ...result }], { notify });
  return { result, warnings: plan.issues.filter((i) => i.severity === 'warning') };
}
