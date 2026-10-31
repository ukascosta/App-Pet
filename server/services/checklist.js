/**
 * Jornada de preparação: transforma regras configuráveis em tarefas de cada viagem.
 * Prazo = data de início da viagem − days_before. As regras podem depender de destino,
 * duração, tipo de viagem, crianças no grupo e nacionalidade.
 * As tarefas geradas são idempotentes (uma por regra por viagem): sincronizar de novo
 * atualiza prazos e textos, sem duplicar e sem perder as conclusões do viajante.
 */
import { newId } from '../lib/ids.js';
import { addDays, daysBetween, nowIso } from '../lib/time.js';
import { normKey } from '../lib/values.js';

/** Regras iniciais (exemplos do PRD §8). A equipe edita, desativa e cria outras no painel. */
export const DEFAULT_RULES = [
  {
    title: 'Confira nomes e dados das reservas',
    description:
      'Confira se o seu nome nas reservas está exatamente igual ao do documento que você vai usar na viagem. Se algo estiver diferente, fale com a Vagari.',
    days_before: null,
    priority: 'alta',
    conditions: {},
  },
  {
    title: 'Verifique o passaporte e os requisitos de entrada',
    description:
      'Confira a validade do passaporte (muitos países exigem validade mínima após a volta) e as regras de entrada do destino em fonte oficial.',
    days_before: 105,
    priority: 'alta',
    official_url: 'https://www.gov.br/pf/pt-br/assuntos/passaporte',
    conditions: { international: true },
  },
  {
    title: 'Verifique visto, vacinas e seguro viagem',
    description:
      'Confirme em fonte oficial se o destino exige visto ou vacinas para a sua nacionalidade e garanta o seguro viagem. Em caso de dúvida, fale com a Vagari.',
    days_before: 75,
    priority: 'alta',
    official_url: 'https://www.gov.br/mre/pt-br/assuntos/portal-consular',
    conditions: { international: true },
  },
  {
    title: 'Autorização de viagem para menores',
    description:
      'Crianças e adolescentes podem precisar de autorização de viagem, conforme quem as acompanha. Confira a exigência no seu caso com antecedência.',
    days_before: 60,
    priority: 'alta',
    conditions: { has_children: true },
  },
  {
    title: 'Revise as reservas e planeje as experiências',
    description: 'Revise o roteiro e as reservas no app e conte para a Vagari se quiser incluir alguma experiência.',
    days_before: 30,
    priority: 'media',
    conditions: {},
  },
  {
    title: 'Monte a mala e separe os documentos',
    description: 'Considere o clima e as atividades do roteiro. Deixe os documentos de viagem à mão e baixe os vouchers no app.',
    days_before: 7,
    priority: 'media',
    conditions: {},
  },
  {
    title: 'Confira check-in, aeroporto e transporte',
    description: 'Confira o horário do voo, faça o check-in on-line quando abrir e planeje como chegar ao aeroporto com folga.',
    days_before: 2,
    priority: 'alta',
    conditions: {},
  },
];

export const CONDITION_KEYS = ['international', 'countries', 'exclude_countries', 'min_days', 'max_days', 'trip_types', 'has_children', 'nationalities'];

export function seedDefaultRules(db) {
  if (db.prepare('SELECT COUNT(*) n FROM checklist_rules').get().n > 0) return;
  const now = nowIso();
  const ins = db.prepare(
    `INSERT INTO checklist_rules (id, title, description, days_before, priority, official_url, conditions, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
  );
  db.transaction(() => {
    for (const r of DEFAULT_RULES)
      ins.run(newId('rul_'), r.title, r.description, r.days_before, r.priority, r.official_url || null, JSON.stringify(r.conditions), now, now);
  })();
}

/** Valida e normaliza as condições de uma regra vindas do painel. */
export function validateConditions(c) {
  if (c === undefined || c === null) return { value: {} };
  if (typeof c !== 'object' || Array.isArray(c)) return { error: 'conditions deve ser um objeto.' };
  const out = {};
  for (const [k, v] of Object.entries(c)) {
    if (!CONDITION_KEYS.includes(k)) return { error: `Condição desconhecida: ${k}. Use: ${CONDITION_KEYS.join(', ')}.` };
    if (v === null || v === '' || (Array.isArray(v) && !v.length)) continue;
    if (['international', 'has_children'].includes(k)) {
      if (typeof v !== 'boolean') return { error: `${k} deve ser true ou false.` };
    } else if (['min_days', 'max_days'].includes(k)) {
      if (!Number.isInteger(v) || v < 1) return { error: `${k} deve ser um inteiro positivo.` };
    } else if (!Array.isArray(v) || v.some((x) => typeof x !== 'string' || !x.trim())) {
      return { error: `${k} deve ser uma lista de textos.` };
    }
    out[k] = v;
  }
  return { value: out };
}

function rootCountry(db, destinationId) {
  return db.prepare('SELECT country FROM destinations WHERE id = ?').get(destinationId)?.country || '';
}

export function ruleApplies(rule, { trip, country, travelers, homeCountry }) {
  const c = typeof rule.conditions === 'string' ? JSON.parse(rule.conditions || '{}') : rule.conditions || {};
  const nk = (s) => normKey(s);
  const international = nk(country) !== nk(homeCountry);
  const duration = daysBetween(trip.start_date, trip.end_date) + 1;
  if (c.international !== undefined && c.international !== international) return false;
  if (c.countries?.length && !c.countries.map(nk).includes(nk(country))) return false;
  if (c.exclude_countries?.length && c.exclude_countries.map(nk).includes(nk(country))) return false;
  if (c.min_days && duration < c.min_days) return false;
  if (c.max_days && duration > c.max_days) return false;
  if (c.trip_types?.length && !c.trip_types.includes(trip.trip_type)) return false;
  if (c.has_children !== undefined && c.has_children !== travelers.some((t) => t.traveler_role === 'crianca')) return false;
  if (c.nationalities?.length) {
    const wanted = c.nationalities.map(nk);
    if (!travelers.some((t) => t.nationality && wanted.includes(nk(t.nationality)))) return false;
  }
  return true;
}

/** Gera/atualiza as tarefas automáticas de uma viagem. Retorna {created, updated, deactivated}. */
export function syncTripTasks(db, tripId, settings) {
  const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(tripId);
  if (!trip) return null;
  const rules = db.prepare('SELECT * FROM checklist_rules').all();
  const travelers = db
    .prepare('SELECT tt.traveler_role, u.nationality FROM trip_travelers tt JOIN users u ON u.id = tt.user_id WHERE tt.trip_id = ?')
    .all(tripId);
  const facts = { trip, country: rootCountry(db, trip.destination_id), travelers, homeCountry: settings.home_country };
  const now = nowIso();
  const stats = { created: 0, updated: 0, deactivated: 0 };
  const find = db.prepare('SELECT * FROM tasks WHERE trip_id = ? AND rule_id = ?');
  db.transaction(() => {
    for (const rule of rules) {
      const applies = rule.active && ruleApplies(rule, facts);
      const existing = find.get(tripId, rule.id);
      const due = rule.days_before === null || rule.days_before === undefined ? null : addDays(trip.start_date, -rule.days_before);
      if (applies) {
        const rec = { title: rule.title, description: rule.description, due_date: due, priority: rule.priority, official_url: rule.official_url, active: 1 };
        if (!existing) {
          db.prepare(
            `INSERT INTO tasks (id, trip_id, rule_id, source, title, description, due_date, priority, official_url, active, created_at, updated_at)
             VALUES (?, ?, ?, 'rule', ?, ?, ?, ?, ?, 1, ?, ?)`,
          ).run(newId('tsk_'), tripId, rule.id, rec.title, rec.description, rec.due_date, rec.priority, rec.official_url, now, now);
          stats.created++;
        } else if (Object.keys(rec).some((k) => (existing[k] ?? null) !== (rec[k] ?? null))) {
          db.prepare(
            'UPDATE tasks SET title = ?, description = ?, due_date = ?, priority = ?, official_url = ?, active = 1, updated_at = ? WHERE id = ?',
          ).run(rec.title, rec.description, rec.due_date, rec.priority, rec.official_url, now, existing.id);
          stats.updated++;
        }
      } else if (existing?.active) {
        db.prepare('UPDATE tasks SET active = 0, updated_at = ? WHERE id = ?').run(now, existing.id);
        stats.deactivated++;
      }
    }
  })();
  return stats;
}

export function syncAllTrips(db, settings) {
  const ids = db.prepare("SELECT id FROM trips WHERE status IN ('draft','published')").all();
  for (const { id } of ids) syncTripTasks(db, id, settings);
  return ids.length;
}
