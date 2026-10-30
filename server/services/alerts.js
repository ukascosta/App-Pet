// Vigia o estoque dos pets e dispara os avisos.
//
// Estados do alerta de cada pet:  ok -> low (acabando) -> empty (acabou)
// Cada subida de gravidade gera UM aviso (tutor + loja). Voltar para "ok"
// (reposição) zera o ciclo e encerra o pedido aberto na loja.

import { recommendationFor, resolveDailyGrams } from '../lib/pet-model.js';
import { currentStockG, stockStatus } from '../lib/stock.js';
import { customerAlert, storeAlert, wholeDays } from './messages.js';

const MAX_ATTEMPTS = 5;
const RETRY_BASE_MS = 5 * 60_000;
const SEVERITY = { ok: 0, low: 1, empty: 2 };

export function createAlertService({ db, config, whatsapp, push, mailer, now = Date.now, log = console }) {
  const getCustomer = db.prepare('SELECT * FROM customers WHERE id = ?');
  const openLeadFor = db.prepare("SELECT * FROM leads WHERE pet_id = ? AND status IN ('new','contacted') ORDER BY id DESC LIMIT 1");

  function enqueue(channel, { customerId = null, leadId = null, payload }, at) {
    db.prepare(
      `INSERT INTO outbox (channel, customer_id, lead_id, payload, next_attempt_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(channel, customerId, leadId, JSON.stringify(payload), at, at);
  }

  function closeOpenLeads(petId, at, note) {
    db.prepare(
      `UPDATE leads SET status = 'closed', note = CASE WHEN note = '' THEN ? ELSE note || ' | ' || ? END, updated_at = ?
       WHERE pet_id = ? AND status IN ('new','contacted')`,
    ).run(note, note, at, petId);
  }

  function trigger(pet, kind, status, at) {
    const customer = getCustomer.get(pet.customer_id);
    const suggestedKg = Math.round(pet.monthly_purchase_g / 100) / 10;
    const daysLeft = Math.max(0, status.daysLeft);

    db.transaction(() => {
      let lead = openLeadFor.get(pet.id);
      if (lead) {
        db.prepare('UPDATE leads SET kind = ?, days_left = ?, updated_at = ? WHERE id = ?').run(kind, daysLeft, at, lead.id);
      } else {
        const info = db
          .prepare(
            `INSERT INTO leads (customer_id, pet_id, kind, days_left, suggested_kg, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(customer.id, pet.id, kind, daysLeft, suggestedKg, at, at);
        lead = { id: info.lastInsertRowid };
      }

      const msg = customerAlert({ petName: pet.name, storeName: config.store.name, kind, daysLeft });
      db.prepare(
        'INSERT INTO alerts (customer_id, pet_id, kind, title, body, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(customer.id, pet.id, kind, msg.title, msg.body, at);

      const petInfo = { name: pet.name, breedName: pet.breed_name, color: pet.color };
      const daysLabel = kind === 'empty' ? 'sem ração' : `${Math.max(1, wholeDays(daysLeft))} dia(s)`;
      enqueue(
        'store_whatsapp',
        {
          leadId: lead.id,
          payload: {
            to: config.store.whatsapp,
            text: storeAlert({ customer, pet: petInfo, kind, daysLeft, suggestedKg }),
            data: {
              customerName: customer.name,
              customerWhatsapp: customer.whatsapp,
              petName: pet.name,
              daysLabel,
              kind,
              suggestedKg,
            },
          },
        },
        at,
      );
      enqueue('customer_push', { customerId: customer.id, payload: { ...msg, url: `/#/pet/${pet.id}`, tag: `pet-${pet.id}` } }, at);
      enqueue('customer_email', { customerId: customer.id, payload: { subject: msg.title, text: msg.body } }, at);
    })();
  }

  /** Compara o estado salvo com o estoque real e dispara o que for preciso. */
  function evaluatePet(pet, at = now()) {
    const status = stockStatus(pet, at);
    const next = status.level;
    const prev = pet.alert_state;
    if (next === prev) return null;

    const moved = db.prepare('UPDATE pets SET alert_state = ? WHERE id = ? AND alert_state = ?').run(next, pet.id, prev).changes;
    if (!moved) return null;

    if (next === 'ok') {
      closeOpenLeads(pet.id, at, 'Estoque reposto pelo cliente.');
      return 'recovered';
    }
    if (SEVERITY[next] < SEVERITY[prev]) return null; // reposição parcial: sem novo aviso

    trigger(pet, next, status, at);
    return next;
  }

  /** Grava o estoque de agora e, se o pet segue a sugestão, atualiza a porção (filhotes crescem). */
  function settlePet(pet, at) {
    let daily = pet.daily_g;
    if (pet.daily_mode === 'recommended') {
      daily = resolveDailyGrams({ mode: 'recommended', recommendedGrams: recommendationFor(pet, at).dailyGrams });
    }
    db.prepare('UPDATE pets SET stock_g = ?, stock_at = ?, daily_g = ? WHERE id = ?').run(currentStockG(pet, at), at, daily, pet.id);
  }

  async function deliver(row) {
    const payload = JSON.parse(row.payload);

    if (row.channel === 'store_whatsapp') {
      if (!payload.to) return { status: 'skipped', reason: 'STORE_WHATSAPP não configurado' };
      await whatsapp.send(payload);
      return { status: 'sent' };
    }
    if (row.channel === 'customer_push') {
      if (!push.hasSubscriptions(row.customer_id)) return { status: 'skipped', reason: 'sem aparelho inscrito' };
      const delivered = await push.notifyCustomer(row.customer_id, payload);
      return delivered ? { status: 'sent' } : { status: 'skipped', reason: 'inscrição expirada' };
    }
    if (row.channel === 'customer_email') {
      if (!mailer) return { status: 'skipped', reason: 'SMTP_URL não configurado' };
      const customer = getCustomer.get(row.customer_id);
      if (!customer) return { status: 'skipped', reason: 'cliente removido' };
      await mailer.send({ to: customer.email, ...payload });
      return { status: 'sent' };
    }
    return { status: 'skipped', reason: 'canal desconhecido' };
  }

  async function processOutbox() {
    const at = now();
    const due = db.prepare("SELECT * FROM outbox WHERE status = 'pending' AND next_attempt_at <= ? ORDER BY id LIMIT 50").all(at);
    for (const row of due) {
      try {
        const result = await deliver(row);
        db.prepare('UPDATE outbox SET status = ?, last_error = ?, sent_at = ?, attempts = attempts + 1 WHERE id = ?').run(
          result.status,
          result.reason ?? null,
          result.status === 'sent' ? now() : null,
          row.id,
        );
      } catch (err) {
        const attempts = row.attempts + 1;
        const exhausted = attempts >= MAX_ATTEMPTS;
        log.error(`[outbox] ${row.channel} #${row.id} falhou (tentativa ${attempts}/${MAX_ATTEMPTS}): ${err.message}`);
        db.prepare('UPDATE outbox SET status = ?, attempts = ?, last_error = ?, next_attempt_at = ? WHERE id = ?').run(
          exhausted ? 'failed' : 'pending',
          attempts,
          String(err.message).slice(0, 300),
          at + attempts * RETRY_BASE_MS,
          row.id,
        );
      }
    }
  }

  let flushing = null;
  /** Evita dois envios simultâneos da mesma fila. */
  const flushOutbox = () => (flushing ??= processOutbox().finally(() => (flushing = null)));

  async function runCheck() {
    const at = now();
    for (const pet of db.prepare('SELECT * FROM pets').all()) {
      settlePet(pet, at);
      evaluatePet(db.prepare('SELECT * FROM pets WHERE id = ?').get(pet.id), at);
    }
    await flushOutbox();
  }

  /** E-mail avulso para o tutor (ex.: redefinição de senha), com a mesma fila e nova tentativa. */
  function queueEmail(customerId, payload) {
    enqueue('customer_email', { customerId, payload }, now());
    flushOutbox().catch(() => {});
  }

  return { evaluatePet, runCheck, flushOutbox, queueEmail };
}

export function startScheduler(alerts, intervalMs, log = console) {
  const tick = () => alerts.runCheck().catch((err) => log.error('[scheduler]', err));
  tick();
  const timer = setInterval(tick, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
