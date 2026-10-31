import { newId } from './ids.js';
import { nowIso } from './time.js';

/** Registra uma alteração (quem, o quê, quando, antes/depois). PRD §5 e §11. */
export function audit(db, { actorId, entityType, entityId, tripId = null, action, before = null, after = null, source = 'panel' }) {
  db.prepare(
    `INSERT INTO audit_log (id, actor_id, entity_type, entity_id, trip_id, action, before_json, after_json, source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    newId('aud_'),
    actorId || null,
    entityType,
    String(entityId),
    tripId,
    action,
    before ? JSON.stringify(stripSecrets(before)) : null,
    after ? JSON.stringify(stripSecrets(after)) : null,
    source,
    nowIso(),
  );
}

function stripSecrets(obj) {
  const { token_hash, code_hash, ...rest } = obj;
  return rest;
}

/** Só os campos que mudaram, para o histórico ficar legível. */
export function diffFields(before, after, fields) {
  const changes = {};
  for (const f of fields) {
    const a = before?.[f] ?? null;
    const b = after?.[f] ?? null;
    if (JSON.stringify(a) !== JSON.stringify(b)) changes[f] = { from: a, to: b };
  }
  return changes;
}
