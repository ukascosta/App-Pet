/**
 * Configurações, regras da jornada, equipe, histórico, métricas e pedidos LGPD.
 */
import { Router } from 'express';
import { HttpError, requireAdmin, requireStaff } from '../http.js';
import { audit } from '../lib/audit.js';
import { newId } from '../lib/ids.js';
import { nowIso } from '../lib/time.js';
import { parseEmail, parseEnum } from '../lib/values.js';
import { ENUMS } from '../domain/entities.js';
import { validateConditions, syncAllTrips } from '../services/checklist.js';

export function adminSystemRoutes(services) {
  const { db, settings } = services;
  const now = () => (services.now ? services.now() : Date.now());
  const r = Router();

  r.get('/me', requireStaff, (req, res) => res.json({ user: { id: req.user.id, name: req.user.name, email: req.user.email, role: req.user.role } }));

  // ------------------------------------------------------------- configurações
  r.get('/settings', requireAdmin, (_req, res) => res.json({ settings: settings.all() }));

  r.patch('/settings', requireAdmin, (req, res) => {
    const out = settings.update(req.body || {}, req.user.id);
    if (out.errors) throw new HttpError(422, out.errors.join(' '), { issues: out.errors.map((m) => ({ severity: 'error', message: m })) });
    const changed = Object.keys(req.body || {});
    audit(db, {
      actorId: req.user.id,
      entityType: 'settings',
      entityId: 'global',
      action: 'update',
      before: Object.fromEntries(changed.map((k) => [k, out.before[k]])),
      after: Object.fromEntries(changed.map((k) => [k, out.after[k]])),
    });
    if (changed.includes('home_country')) syncAllTrips(db, out.after);
    res.json({ settings: out.after });
  });

  // ------------------------------------------------------------- regras da jornada de preparação
  const ruleView = (x) => ({ ...x, conditions: JSON.parse(x.conditions || '{}'), active: !!x.active });

  function parseRule(body, existing) {
    const rule = {
      title: body.title ?? existing?.title,
      description: body.description ?? existing?.description ?? null,
      days_before: body.days_before !== undefined ? body.days_before : existing?.days_before ?? null,
      priority: body.priority ?? existing?.priority ?? 'media',
      official_url: body.official_url !== undefined ? body.official_url : existing?.official_url ?? null,
      active: body.active !== undefined ? !!body.active : existing ? !!existing.active : true,
    };
    const errors = [];
    if (!rule.title || typeof rule.title !== 'string' || rule.title.length > 160) errors.push('Informe um título de até 160 caracteres.');
    if (rule.days_before !== null && (!Number.isInteger(rule.days_before) || rule.days_before < 0 || rule.days_before > 730))
      errors.push('days_before deve ser um inteiro entre 0 e 730 (ou vazio para "assim que a viagem for criada").');
    const pr = parseEnum(rule.priority, ENUMS.PRIORITIES);
    if (pr.error) errors.push(`Prioridade: ${pr.hint}`);
    else rule.priority = pr.value;
    if (rule.official_url && !/^https?:\/\//.test(rule.official_url)) errors.push('official_url deve começar com https://');
    const cond = validateConditions(body.conditions !== undefined ? body.conditions : existing ? JSON.parse(existing.conditions) : {});
    if (cond.error) errors.push(cond.error);
    if (errors.length) throw new HttpError(422, errors.join(' '));
    return { ...rule, conditions: JSON.stringify(cond.value) };
  }

  r.get('/rules', requireAdmin, (_req, res) => {
    res.json({ rules: db.prepare('SELECT * FROM checklist_rules ORDER BY days_before IS NOT NULL, days_before DESC').all().map(ruleView) });
  });

  r.post('/rules', requireAdmin, (req, res) => {
    const rule = parseRule(req.body || {});
    const id = newId('rul_');
    const ts = nowIso(now());
    db.prepare(
      `INSERT INTO checklist_rules (id, title, description, days_before, priority, official_url, conditions, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, rule.title, rule.description, rule.days_before, rule.priority, rule.official_url, rule.conditions, rule.active ? 1 : 0, ts, ts);
    audit(db, { actorId: req.user.id, entityType: 'checklist_rule', entityId: id, action: 'create', after: rule });
    const trips = syncAllTrips(db, settings.all());
    res.status(201).json({ rule: ruleView(db.prepare('SELECT * FROM checklist_rules WHERE id = ?').get(id)), synced_trips: trips });
  });

  r.patch('/rules/:id', requireAdmin, (req, res) => {
    const existing = db.prepare('SELECT * FROM checklist_rules WHERE id = ?').get(req.params.id);
    if (!existing) throw new HttpError(404, 'Regra não encontrada.');
    const rule = parseRule(req.body || {}, existing);
    db.prepare(
      'UPDATE checklist_rules SET title = ?, description = ?, days_before = ?, priority = ?, official_url = ?, conditions = ?, active = ?, updated_at = ? WHERE id = ?',
    ).run(rule.title, rule.description, rule.days_before, rule.priority, rule.official_url, rule.conditions, rule.active ? 1 : 0, nowIso(now()), existing.id);
    audit(db, { actorId: req.user.id, entityType: 'checklist_rule', entityId: existing.id, action: 'update', before: ruleView(existing), after: rule });
    const trips = syncAllTrips(db, settings.all());
    res.json({ rule: ruleView(db.prepare('SELECT * FROM checklist_rules WHERE id = ?').get(existing.id)), synced_trips: trips });
  });

  /** Excluir uma regra desativa as tarefas geradas por ela (as conclusões ficam no histórico). */
  r.delete('/rules/:id', requireAdmin, (req, res) => {
    const existing = db.prepare('SELECT * FROM checklist_rules WHERE id = ?').get(req.params.id);
    if (!existing) throw new HttpError(404, 'Regra não encontrada.');
    db.transaction(() => {
      db.prepare('UPDATE tasks SET active = 0, updated_at = ? WHERE rule_id = ?').run(nowIso(now()), existing.id);
      db.prepare('DELETE FROM checklist_rules WHERE id = ?').run(existing.id);
      audit(db, { actorId: req.user.id, entityType: 'checklist_rule', entityId: existing.id, action: 'delete', before: ruleView(existing) });
    })();
    res.json({ ok: true });
  });

  // ------------------------------------------------------------- equipe e usuários
  r.get('/users', requireAdmin, (req, res) => {
    const { role, q } = req.query;
    let sql = 'SELECT id, email, name, phone, role, created_at, last_login_at, disabled_at FROM users WHERE 1 = 1';
    const args = [];
    if (role) (sql += ' AND role = ?'), args.push(role);
    if (q) (sql += ' AND (email LIKE ? OR name LIKE ?)'), args.push(`%${q}%`, `%${q}%`);
    res.json({ users: db.prepare(sql + ' ORDER BY created_at DESC LIMIT 500').all(...args) });
  });

  /** Cadastra alguém da equipe (admin ou editor). Viajantes entram pelas viagens. */
  r.post('/users', requireAdmin, (req, res) => {
    const email = parseEmail(req.body?.email || '');
    if (email.error) throw new HttpError(422, email.error);
    const role = req.body?.role;
    if (!['admin', 'editor'].includes(role)) throw new HttpError(422, 'role deve ser admin ou editor.');
    const name = String(req.body?.name || '').slice(0, 120);
    const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email.value);
    const ts = nowIso(now());
    let id;
    if (existing) {
      id = existing.id;
      db.prepare('UPDATE users SET role = ?, name = COALESCE(NULLIF(?, \'\'), name), disabled_at = NULL, updated_at = ? WHERE id = ?').run(role, name, ts, id);
      audit(db, { actorId: req.user.id, entityType: 'user', entityId: id, action: 'set_role', before: { role: existing.role }, after: { role } });
    } else {
      id = newId('usr_');
      db.prepare('INSERT INTO users (id, email, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, email.value, name, role, ts, ts);
      audit(db, { actorId: req.user.id, entityType: 'user', entityId: id, action: 'create', after: { email: email.value, role } });
    }
    res.status(existing ? 200 : 201).json({ user: db.prepare('SELECT id, email, name, role, disabled_at FROM users WHERE id = ?').get(id) });
  });

  r.patch('/users/:id', requireAdmin, (req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!user) throw new HttpError(404, 'Usuário não encontrado.');
    const { role, disabled } = req.body || {};
    if (role !== undefined && !['admin', 'editor', 'traveler'].includes(role)) throw new HttpError(422, 'role inválido.');
    const losingAdmin = user.role === 'admin' && ((role && role !== 'admin') || disabled === true);
    if (losingAdmin) {
      const admins = db.prepare("SELECT COUNT(*) n FROM users WHERE role = 'admin' AND disabled_at IS NULL").get().n;
      if (admins <= 1) throw new HttpError(409, 'Não é possível remover o último administrador.');
    }
    const ts = nowIso(now());
    db.transaction(() => {
      if (role !== undefined) db.prepare('UPDATE users SET role = ?, updated_at = ? WHERE id = ?').run(role, ts, user.id);
      if (disabled !== undefined) {
        db.prepare('UPDATE users SET disabled_at = ?, updated_at = ? WHERE id = ?').run(disabled ? ts : null, ts, user.id);
        if (disabled) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
      }
      audit(db, { actorId: req.user.id, entityType: 'user', entityId: user.id, action: 'update', before: { role: user.role, disabled: !!user.disabled_at }, after: { role: role ?? user.role, disabled: disabled ?? !!user.disabled_at } });
    })();
    res.json({ user: db.prepare('SELECT id, email, name, role, disabled_at FROM users WHERE id = ?').get(user.id) });
  });

  // ------------------------------------------------------------- histórico
  r.get('/audit', requireAdmin, (req, res) => {
    const { trip_id, entity_type, entity_id, actor_id } = req.query;
    const limit = Math.min(Number(req.query.limit) || 100, 1000);
    let sql = `SELECT a.*, u.email actor_email, u.name actor_name FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id WHERE 1 = 1`;
    const args = [];
    if (trip_id) (sql += ' AND a.trip_id = ?'), args.push(trip_id);
    if (entity_type) (sql += ' AND a.entity_type = ?'), args.push(entity_type);
    if (entity_id) (sql += ' AND a.entity_id = ?'), args.push(entity_id);
    if (actor_id) (sql += ' AND a.actor_id = ?'), args.push(actor_id);
    const rows = db.prepare(sql + ' ORDER BY a.created_at DESC, a.rowid DESC LIMIT ?').all(...args, limit);
    res.json({
      entries: rows.map((x) => ({ ...x, before: x.before_json ? JSON.parse(x.before_json) : null, after: x.after_json ? JSON.parse(x.after_json) : null, before_json: undefined, after_json: undefined })),
    });
  });

  // ------------------------------------------------------------- métricas do MVP (PRD §15)
  r.get('/metrics', requireAdmin, (req, res) => {
    const days = Math.min(Number(req.query.days) || 30, 365);
    const since = nowIso(now() - days * 86_400_000);
    const one = (sql, ...a) => db.prepare(sql).get(...a);
    const invited = one(`SELECT COUNT(*) n FROM trip_travelers tt JOIN trips t ON t.id = tt.trip_id WHERE t.status = 'published' AND tt.invitation_status != 'not_sent'`).n;
    const activated = one(
      `SELECT COUNT(*) n FROM trip_travelers tt JOIN trips t ON t.id = tt.trip_id JOIN users u ON u.id = tt.user_id
       WHERE t.status = 'published' AND tt.invitation_status != 'not_sent' AND (tt.invitation_status = 'accepted' OR u.last_login_at IS NOT NULL)`,
    ).n;
    const trips = db.prepare("SELECT id FROM trips WHERE status IN ('draft','published')").all();
    const complete = trips.filter(
      (t) =>
        one('SELECT COUNT(*) n FROM trip_travelers WHERE trip_id = ?', t.id).n &&
        one('SELECT COUNT(*) n FROM flight_segments WHERE trip_id = ?', t.id).n &&
        one('SELECT COUNT(*) n FROM accommodations WHERE trip_id = ?', t.id).n &&
        one('SELECT COUNT(*) n FROM documents WHERE trip_id = ? AND visible_to_traveler = 1', t.id).n,
    ).length;
    const taskSlots = one(
      `SELECT COUNT(*) n FROM tasks k JOIN trips t ON t.id = k.trip_id AND t.status = 'published'
       JOIN trip_travelers tt ON tt.trip_id = t.id AND tt.invitation_status != 'revoked' WHERE k.active = 1`,
    ).n;
    const taskDone = one(
      `SELECT COUNT(*) n FROM task_completions c JOIN tasks k ON k.id = c.task_id AND k.active = 1
       JOIN trips t ON t.id = k.trip_id AND t.status = 'published'`,
    ).n;
    const events = Object.fromEntries(
      db.prepare('SELECT name, COUNT(*) n FROM usage_events WHERE created_at >= ? GROUP BY name').all(since).map((x) => [x.name, x.n]),
    );
    const jobs = db.prepare("SELECT * FROM import_jobs WHERE created_at >= ? AND status IN ('completed','canceled','failed')").all(since);
    const completed = jobs.filter((j) => j.status === 'completed');
    const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null);
    res.json({
      period_days: days,
      activation: { invited, activated, percent: pct(activated, invited) },
      trips_essential_complete: { trips: trips.length, complete, percent: pct(complete, trips.length) },
      tasks: { completed: taskDone, expected: taskSlots, percent: pct(taskDone, taskSlots) },
      usage: events,
      favorites: one('SELECT COUNT(*) n FROM favorites').n,
      whatsapp_clicks: events.whatsapp_click || 0,
      imports: {
        total: jobs.length,
        completed: completed.length,
        with_errors_on_first_preview: jobs.filter((j) => j.error_count > 0).length,
        error_rate_percent: pct(jobs.filter((j) => j.error_count > 0).length, jobs.length),
        avg_minutes_preview_to_confirm: completed.length
          ? Math.round(completed.reduce((s, j) => s + (Date.parse(j.completed_at) - Date.parse(j.created_at)), 0) / completed.length / 600) / 100
          : null,
      },
    });
  });

  // ------------------------------------------------------------- LGPD
  r.get('/privacy-requests', requireAdmin, (_req, res) => {
    res.json({
      requests: db
        .prepare('SELECT p.*, u.email, u.name FROM privacy_requests p JOIN users u ON u.id = p.user_id ORDER BY p.status, p.created_at DESC')
        .all(),
    });
  });

  r.patch('/privacy-requests/:id', requireAdmin, (req, res) => {
    const p = db.prepare('SELECT * FROM privacy_requests WHERE id = ?').get(req.params.id);
    if (!p) throw new HttpError(404, 'Pedido não encontrado.');
    const status = req.body?.status;
    if (!['open', 'in_progress', 'resolved', 'rejected'].includes(status)) throw new HttpError(422, 'status inválido.');
    db.prepare('UPDATE privacy_requests SET status = ?, resolved_at = ? WHERE id = ?').run(status, ['resolved', 'rejected'].includes(status) ? nowIso(now()) : null, p.id);
    audit(db, { actorId: req.user.id, entityType: 'privacy_request', entityId: p.id, action: 'update', before: { status: p.status }, after: { status } });
    res.json({ ok: true });
  });

  return r;
}
