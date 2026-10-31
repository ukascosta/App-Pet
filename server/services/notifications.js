/**
 * Notificações no app + e-mail (PRD §10). Push fica para depois que o app mobile estiver definido.
 * - Avisos essenciais (operacionais) sempre vão por e-mail.
 * - Os demais respeitam as preferências do viajante.
 * - dedupe_key evita alerta duplicado (ex.: lembrete da mesma tarefa).
 */
import { newId } from '../lib/ids.js';
import { daysBetween, nowIso, todayIn } from '../lib/time.js';

export const NOTIFICATION_PREFS = {
  email_updates: { label: 'E-mail quando a Vagari publicar documentos ou mudanças', default: true },
  email_reminders: { label: 'E-mail com lembretes de tarefas', default: true },
};

const PREF_FOR_KIND = { document: 'email_updates', trip_update: 'email_updates', task_reminder: 'email_reminders', announcement: 'email_updates' };

export function userPrefs(user) {
  let p = {};
  try {
    p = JSON.parse(user.notification_prefs || '{}');
  } catch {
    /* padrão */
  }
  return Object.fromEntries(Object.entries(NOTIFICATION_PREFS).map(([k, d]) => [k, typeof p[k] === 'boolean' ? p[k] : d.default]));
}

export function createNotifications({ db, mailer, config, log = console, now = () => Date.now() }) {
  const travelersOf = db.prepare(
    `SELECT u.* FROM trip_travelers tt JOIN users u ON u.id = tt.user_id
     WHERE tt.trip_id = ? AND tt.invitation_status != 'revoked' AND u.disabled_at IS NULL`,
  );

  /** Cria a notificação para cada viajante da viagem (se a viagem estiver publicada). */
  function notifyTrip(tripId, { kind, title, body = null, link = null, essential = false, dedupe = null }) {
    const trip = db.prepare('SELECT status FROM trips WHERE id = ?').get(tripId);
    if (!trip || trip.status !== 'published') return 0;
    let count = 0;
    const ins = db.prepare(
      `INSERT OR IGNORE INTO notifications (id, user_id, trip_id, kind, title, body, link, essential, dedupe_key, email_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const user of travelersOf.all(tripId)) {
      const pref = PREF_FOR_KIND[kind];
      const wantsEmail = essential || (pref ? userPrefs(user)[pref] : false);
      const key = dedupe ? `${dedupe}:${user.id}` : null;
      const r = ins.run(newId('ntf_'), user.id, tripId, kind, title, body, link, essential ? 1 : 0, key, wantsEmail ? 'pending' : 'skip', nowIso(now()));
      count += r.changes;
    }
    return count;
  }

  /** Envia os e-mails pendentes. Falhas ficam marcadas e não travam o resto. */
  async function dispatchEmails() {
    const pending = db
      .prepare(
        `SELECT n.*, u.email, u.name FROM notifications n JOIN users u ON u.id = n.user_id
         WHERE n.email_status = 'pending' ORDER BY n.created_at LIMIT 100`,
      )
      .all();
    for (const n of pending) {
      try {
        const link = n.link ? `${config.publicUrl}${n.link}` : config.publicUrl;
        await mailer.send({
          to: n.email,
          subject: `Vagari · ${n.title}`,
          text: `Olá, ${n.name || 'viajante'}!\n\n${n.title}\n${n.body ? `\n${n.body}\n` : ''}\nAbra o app: ${link}\n\nVagari`,
        });
        db.prepare("UPDATE notifications SET email_status = 'sent' WHERE id = ?").run(n.id);
      } catch (e) {
        log.error?.(`Falha ao enviar e-mail ${n.id}: ${e.message}`);
        db.prepare("UPDATE notifications SET email_status = 'failed' WHERE id = ?").run(n.id);
      }
    }
    return pending.length;
  }

  /**
   * Lembretes de tarefas próximas do prazo, calculados no fuso da viagem.
   * Um lembrete por tarefa por viajante (dedupe), só para quem ainda não concluiu.
   */
  function runTaskReminders(daysBefore) {
    const rows = db
      .prepare(
        `SELECT t.id task_id, t.title, t.due_date, tr.id trip_id, tr.timezone, u.id user_id, u.notification_prefs
         FROM tasks t
         JOIN trips tr ON tr.id = t.trip_id AND tr.status = 'published'
         JOIN trip_travelers tt ON tt.trip_id = tr.id AND tt.invitation_status != 'revoked'
         JOIN users u ON u.id = tt.user_id AND u.disabled_at IS NULL
         LEFT JOIN task_completions c ON c.task_id = t.id AND c.user_id = u.id
         WHERE t.active = 1 AND t.due_date IS NOT NULL AND c.task_id IS NULL`,
      )
      .all();
    const ins = db.prepare(
      `INSERT OR IGNORE INTO notifications (id, user_id, trip_id, kind, title, body, link, essential, dedupe_key, email_status, created_at)
       VALUES (?, ?, ?, 'task_reminder', ?, ?, ?, 0, ?, ?, ?)`,
    );
    let created = 0;
    for (const r of rows) {
      const left = daysBetween(todayIn(r.timezone, now()), r.due_date);
      if (left < 0 || left > daysBefore) continue;
      const when = left === 0 ? 'vence hoje' : left === 1 ? 'vence amanhã' : `vence em ${left} dias`;
      const wantsEmail = userPrefs(r).email_reminders;
      created += ins.run(
        newId('ntf_'),
        r.user_id,
        r.trip_id,
        `Tarefa: ${r.title}`,
        `O prazo sugerido ${when}.`,
        `/viagem/${encodeURIComponent(r.trip_id)}/preparacao`,
        `task:${r.task_id}:${r.user_id}`,
        wantsEmail ? 'pending' : 'skip',
        nowIso(now()),
      ).changes;
    }
    return created;
  }

  return { notifyTrip, dispatchEmails, runTaskReminders };
}
