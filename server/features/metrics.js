// Indicadores do painel da loja.

import { stockStatus } from '../lib/stock.js';
import { DAY } from './settings.js';

export function dashboard({ customers, pets, orders, subscriptions, now }) {
  const since = now - 30 * DAY;
  const confirmed = orders.filter((o) => o.status === 'confirmed');
  const month = confirmed.filter((o) => (o.confirmed_at ?? o.created_at) >= since);
  const app = month.filter((o) => o.source === 'app');
  const levels = pets.map((p) => stockStatus(p, now).level);
  const active = subscriptions.filter((s) => s.status === 'active' && (!s.renews_at || s.renews_at > now));
  const mrr = active.reduce((s, x) => s + x.price_cents, 0);

  // receita recorrente: clube + ração de quem repõe com frequência (2+ compras de ração)
  const rationBuyers = new Map();
  for (const o of confirmed) if (o.items.some((l) => l.category === 'racao')) rationBuyers.set(o.customer_id, (rationBuyers.get(o.customer_id) ?? 0) + 1);
  const recurringRation = month.filter((o) => (rationBuyers.get(o.customer_id) ?? 0) >= 2)
    .reduce((s, o) => s + o.items.filter((l) => l.category === 'racao').reduce((t, l) => t + l.unit_cents * l.qty - l.club_discount_cents, 0), 0);

  // taxa de recompra: entre quem comprou nos últimos 180 dias, quantos compraram 2+ vezes
  const window = confirmed.filter((o) => o.created_at >= now - 180 * DAY);
  const counts = new Map();
  for (const o of window) counts.set(o.customer_id, (counts.get(o.customer_id) ?? 0) + 1);
  const buyers = counts.size;
  const repeat = [...counts.values()].filter((n) => n >= 2).length;

  // faturamento das últimas 8 semanas (app × loja)
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const end = now - (7 - i) * 7 * DAY;
    const start = end - 7 * DAY;
    const inWeek = confirmed.filter((o) => (o.confirmed_at ?? o.created_at) > start && (o.confirmed_at ?? o.created_at) <= end);
    const sum = (src) => inWeek.filter((o) => o.source === src).reduce((s, o) => s + o.total_cents, 0);
    return { start: new Date(start).toISOString(), appCents: sum('app'), storeCents: sum('loja') };
  });

  const revenue = month.reduce((s, o) => s + o.total_cents, 0);
  return {
    customers: customers.length,
    pets: pets.length,
    refillsSoon: levels.filter((l) => l === 'low').length,
    refillsLate: levels.filter((l) => l === 'empty').length,
    appOrders: app.length,
    appRevenueCents: app.reduce((s, o) => s + o.total_cents, 0),
    pendingAppOrders: orders.filter((o) => o.status === 'requested').length,
    recurringRevenueCents: mrr + recurringRation,
    clubMrrCents: mrr,
    recurringRationCents: recurringRation,
    members: active.length,
    pendingMembers: subscriptions.filter((s) => s.status === 'pending').length,
    avgTicketCents: month.length ? Math.round(revenue / month.length) : 0,
    revenueCents: revenue,
    ordersCount: month.length,
    repurchaseRate: buyers ? repeat / buyers : 0,
    weeks,
  };
}
