// Pontos com validade. O saldo consome primeiro os pontos que vencem antes (FIFO por vencimento),
// para que gastar pontos já vencidos nunca deixe o saldo negativo.

import { DAY } from './settings.js';

/** @param ledger linhas da tabela points de UM cliente */
export function pointsBalance(ledger, now) {
  const grants = ledger
    .filter((r) => r.delta > 0)
    .map((r) => ({ ...r, left: r.delta, exp: r.expires_at ?? Infinity }))
    .sort((a, b) => a.created_at - b.created_at || a.id - b.id);
  const debits = ledger.filter((r) => r.delta < 0).sort((a, b) => a.created_at - b.created_at || a.id - b.id);

  for (const d of debits) {
    let need = -d.delta;
    // usa os pontos válidos no momento do gasto, os que vencem antes primeiro
    const usable = grants.filter((g) => g.left > 0 && g.created_at <= d.created_at && g.exp > d.created_at).sort((a, b) => a.exp - b.exp);
    for (const g of usable) {
      const take = Math.min(g.left, need);
      g.left -= take;
      need -= take;
      if (!need) break;
    }
  }
  const alive = grants.filter((g) => g.left > 0 && g.exp > now);
  const balance = alive.reduce((s, g) => s + g.left, 0);
  const soon = alive.filter((g) => g.exp - now <= 30 * DAY).reduce((s, g) => s + g.left, 0);
  const nextExp = alive.filter((g) => g.exp !== Infinity).sort((a, b) => a.exp - b.exp)[0];
  return { balance, expiringIn30Days: soon, nextExpiration: nextExp ? { points: nextExp.left, at: nextExp.exp } : null };
}

export const balanceOf = (repo, customerId, now) => pointsBalance(repo.all('points', { customer_id: customerId }), now).balance;

export function grantPoints(repo, { customerId, points, reason, orderId = null, now, settings }) {
  if (!points) return null;
  return repo.insert('points', {
    customer_id: customerId, delta: points, reason, order_id: orderId, created_at: now,
    expires_at: points > 0 ? now + settings.pointsValidityDays * DAY : null,
  });
}

export const referralCode = (customerId) => `PET${(customerId * 7919 + 1000).toString(36).toUpperCase()}`;
export function customerByReferral(repo, code) {
  const clean = String(code ?? '').trim().toUpperCase();
  return repo.all('customers').find((c) => referralCode(c.id) === clean) ?? null;
}
