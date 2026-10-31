// Rotas dos módulos comerciais, independentes de framework: [método, caminho, função(ctx)].
// O servidor monta com Express (features/express.js); a pré-visualização monta com o roteador dela.
// ctx = { repo, customer?, body, query, params, now, settings, hooks, store: { name, whatsapp } }

import { serializePet } from '../lib/pet-model.js';
import { formatWhatsApp, whatsAppLink } from '../lib/phone.js';
import { HttpError, bool, number, oneOf, text } from '../lib/validate.js';
import { careView, completeCare, CARE_KINDS, SERVICE_LABEL } from './care.js';
import { activate, activeSubscription, benefits, isMember, pendingSubscription } from './club.js';
import { dashboard } from './metrics.js';
import { computeOpportunities, rationOf, TO_LEAD } from './opportunities.js';
import { cancelOrder, confirmOrder, createOrder, productCycles, quote } from './orders.js';
import { grantPoints, pointsBalance, referralCode } from './points.js';
import { DEFAULT_SETTINGS, DAY } from './settings.js';
import { buildShowcase, CATEGORY_LABEL, productView } from './showcase.js';

const iso = (t) => (t ? new Date(t).toISOString() : null);
const randomCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();
const ownPet = (repo, customer, id) => {
  const pet = repo.get('pets', Number(id));
  if (!pet || pet.customer_id !== customer.id) throw new HttpError(404, 'Pet não encontrado.', 'petId');
  return pet;
};
const dateInput = (v, field, label) => {
  const t = Date.parse(v);
  if (!Number.isFinite(t)) throw new HttpError(400, `Informe ${label}.`, field);
  return t;
};

const orderView = (o, repo) => ({
  id: o.id, status: o.status, source: o.source, delivery: o.delivery,
  items: o.items.map((l) => ({ productId: l.product_id, name: l.name, qty: l.qty, unitCents: l.unit_cents, category: l.category })),
  subtotalCents: o.subtotal_cents, discountCents: o.discount_cents, shippingCents: o.shipping_cents, totalCents: o.total_cents,
  pointsUsed: o.points_used, pointsEarned: o.points_earned, couponCode: o.coupon_code, note: o.note,
  petName: o.pet_id ? repo.get('pets', o.pet_id)?.name ?? null : null, createdAt: iso(o.created_at), confirmedAt: iso(o.confirmed_at),
});

const subView = (s) => s && { id: s.id, status: s.status, priceCents: s.price_cents, startedAt: iso(s.started_at), renewsAt: iso(s.renews_at), createdAt: iso(s.created_at) };

function pointsView(repo, customerId, now, settings) {
  const ledger = repo.all('points', { customer_id: customerId });
  return {
    ...pointsBalance(ledger, now),
    history: ledger.sort((a, b) => b.created_at - a.created_at).slice(0, 50).map((r) => ({ delta: r.delta, reason: r.reason, at: iso(r.created_at), expiresAt: iso(r.expires_at) })),
    rules: { reaisPerPoint: settings.centsPerPoint / 100, discountBlock: settings.pointsDiscountBlock, discountCents: settings.pointsDiscountCents, validityDays: settings.pointsValidityDays, referralPoints: settings.referralPoints, clubMultiplier: settings.clubPointsMultiplier },
  };
}

function availableSlots(repo, now) {
  return repo.all('slots').filter((s) => !s.appointment_id && s.starts_at > now && s.starts_at < now + 21 * DAY).sort((a, b) => a.starts_at - b.starts_at);
}

// ======================= TUTOR =======================

export const tutorRoutes = [
  // resumo para a tela inicial: clube, pontos, próximos cuidados e 4 sugestões
  ['GET', '/summary', ({ repo, customer, now, settings }) => {
    const member = isMember(repo, customer.id, now);
    const pets = repo.all('pets', { customer_id: customer.id });
    const orders = repo.all('orders', { customer_id: customer.id });
    const sections = buildShowcase({ products: repo.all('products'), pets, orders, member, now, settings });
    const picks = sections.flatMap((s) => s.items.map((i) => ({ ...i, section: s.title }))).filter((i) => !i.locked);
    const seen = new Set();
    const care = repo.all('care', { customer_id: customer.id }).filter((e) => !e.done_at).sort((a, b) => a.due_at - b.due_at).slice(0, 3);
    const bdays = member ? pets.filter((p) => new Date(p.birth_at).getMonth() === new Date(now).getMonth()).map((p) => p.name) : [];
    return {
      member, pendingClub: Boolean(pendingSubscription(repo, customer.id)), clubPriceCents: settings.clubPriceCents,
      points: pointsBalance(repo.all('points', { customer_id: customer.id }), now).balance,
      picks: picks.filter((i) => !seen.has(i.id) && seen.add(i.id)).slice(0, 6),
      care: care.map((e) => careView(e, pets.find((p) => p.id === e.pet_id), now)),
      pendingOrders: orders.filter((o) => o.status === 'requested').length,
      birthdayPets: bdays,
    };
  }],

  // ----- vitrine e pedidos -----
  ['GET', '/showcase', ({ repo, customer, now, settings }) => {
    const member = isMember(repo, customer.id, now);
    const pets = repo.all('pets', { customer_id: customer.id });
    return {
      member,
      sections: buildShowcase({ products: repo.all('products'), pets, orders: repo.all('orders', { customer_id: customer.id }), member, now, settings }),
      pets: pets.map((p) => ({ id: p.id, name: p.name, species: p.species })),
      shipping: { cents: settings.shippingCents, freeMinCents: settings.freeShippingMinCents },
    };
  }],

  ['POST', '/orders/quote', ({ repo, customer, body, now, settings }) =>
    quote(repo, { ...body, customerId: customer.id }, { now, settings })],

  ['POST', '/orders', ({ repo, customer, body, now, settings, hooks }) => {
    if (!customer.whatsapp) throw new HttpError(403, 'Complete seu cadastro antes de fazer pedidos.');
    const order = createOrder(repo, { ...body, customerId: customer.id, source: 'app' }, { now, settings, hooks });
    hooks.storeNotice?.(`Novo pedido #${order.id} pelo app: ${customer.name}, R$ ${(order.total_cents / 100).toFixed(2).replace('.', ',')}`);
    return { status: 201, body: { order: orderView(order, repo) } };
  }],

  ['GET', '/orders', ({ repo, customer }) => ({
    orders: repo.all('orders', { customer_id: customer.id }).sort((a, b) => b.created_at - a.created_at).map((o) => orderView(o, repo)),
  })],

  ['POST', '/orders/:id/cancel', ({ repo, customer, params, now, settings }) => {
    const o = repo.get('orders', Number(params.id));
    if (!o || o.customer_id !== customer.id) throw new HttpError(404, 'Pedido não encontrado.');
    if (o.status !== 'requested') throw new HttpError(400, 'A loja já confirmou este pedido. Fale com a loja para cancelar.');
    return { order: orderView(cancelOrder(repo, o, { now, settings }), repo) };
  }],

  // ----- clube -----
  ['GET', '/club', ({ repo, customer, now, settings }) => ({
    priceCents: settings.clubPriceCents, benefits: benefits(settings),
    subscription: subView(activeSubscription(repo, customer.id, now) ?? pendingSubscription(repo, customer.id)),
    member: isMember(repo, customer.id, now),
  })],

  ['POST', '/club/subscribe', ({ repo, customer, now, settings, hooks }) => {
    if (isMember(repo, customer.id, now)) throw new HttpError(400, 'Você já é do Clube Pet.');
    const sub = pendingSubscription(repo, customer.id) ?? repo.insert('club_subscriptions', { customer_id: customer.id, status: 'pending', price_cents: settings.clubPriceCents, created_at: now });
    hooks.storeNotice?.(`${customer.name} quer assinar o Clube Pet.`);
    return { subscription: subView(sub) };
  }],

  ['POST', '/club/cancel', ({ repo, customer, now }) => {
    const sub = activeSubscription(repo, customer.id, now) ?? pendingSubscription(repo, customer.id);
    if (!sub) throw new HttpError(400, 'Você não tem assinatura ativa.');
    repo.update('club_subscriptions', sub.id, { status: 'cancelled', cancelled_at: now });
    return { ok: true };
  }],

  // ----- pontos -----
  ['GET', '/points', ({ repo, customer, now, settings }) => ({
    ...pointsView(repo, customer.id, now, settings),
    member: isMember(repo, customer.id, now),
    rewards: repo.all('rewards').filter((r) => r.active).map((r) => ({ id: r.id, name: r.name, costPoints: r.cost_points, kind: r.kind, valueCents: r.value_cents })),
    redemptions: repo.all('redemptions', { customer_id: customer.id }).sort((a, b) => b.created_at - a.created_at).map((r) => ({ code: r.code, name: r.name, status: r.status, createdAt: iso(r.created_at) })),
    referralCode: referralCode(customer.id),
    referrals: repo.all('referrals', { referrer_id: customer.id }).length,
  })],

  ['POST', '/points/redeem', ({ repo, customer, body, now, settings }) => {
    const reward = repo.get('rewards', Number(body.rewardId));
    if (!reward || !reward.active) throw new HttpError(404, 'Recompensa não encontrada.');
    const { balance } = pointsBalance(repo.all('points', { customer_id: customer.id }), now);
    if (balance < reward.cost_points) throw new HttpError(400, `Faltam ${reward.cost_points - balance} pontos para esta recompensa.`);
    const code = `R-${randomCode()}`;
    repo.transaction(() => {
      grantPoints(repo, { customerId: customer.id, points: -reward.cost_points, reason: `Troca: ${reward.name}`, now, settings });
      repo.insert('redemptions', { customer_id: customer.id, reward_id: reward.id, name: reward.name, code, status: 'issued', created_at: now });
    });
    return { code, name: reward.name };
  }],

  // ----- agenda de cuidados -----
  ['GET', '/care', ({ repo, customer, now, settings }) => {
    const pets = repo.all('pets', { customer_id: customer.id });
    const member = isMember(repo, customer.id, now);
    const events = repo.all('care', { customer_id: customer.id }).sort((a, b) => a.due_at - b.due_at);
    const cycles = productCycles(repo.all('orders', { customer_id: customer.id }), repo.all('products'), now);
    return {
      kinds: CARE_KINDS,
      upcoming: events.filter((e) => !e.done_at).map((e) => careView(e, pets.find((p) => p.id === e.pet_id), now)),
      history: events.filter((e) => e.done_at).sort((a, b) => b.done_at - a.done_at).slice(0, 30).map((e) => careView(e, pets.find((p) => p.id === e.pet_id), now)),
      productCycles: cycles.map((c) => ({ productId: c.product.id, name: c.product.name, boughtAt: iso(c.boughtAt), dueAt: iso(c.dueAt), daysLeft: c.daysLeft, cycleDays: c.product.cycle_days })),
      appointments: repo.all('appointments', { customer_id: customer.id }).sort((a, b) => b.starts_at - a.starts_at).map((a) => ({
        id: a.id, service: a.service, serviceLabel: SERVICE_LABEL[a.service] ?? a.service, startsAt: iso(a.starts_at), status: a.status,
        petName: pets.find((p) => p.id === a.pet_id)?.name ?? '', priceCents: a.price_cents - a.discount_cents,
      })),
      slots: availableSlots(repo, now).map((s) => ({
        id: s.id, service: s.service, serviceLabel: SERVICE_LABEL[s.service] ?? s.service, startsAt: iso(s.starts_at), minutes: s.minutes, priceCents: s.price_cents,
        clubPriceCents: Math.round(s.price_cents * (1 - settings.clubServiceDiscount / 100)),
      })),
      member,
      pets: pets.map((p) => ({ id: p.id, name: p.name, species: p.species })),
    };
  }],

  ['POST', '/care', ({ repo, customer, body, now }) => {
    const pet = ownPet(repo, customer, body.petId);
    const kind = oneOf(body.kind, 'kind', Object.keys(CARE_KINDS), 'o tipo de cuidado');
    const ev = repo.insert('care', {
      customer_id: customer.id, pet_id: pet.id, kind, title: text(body.title || CARE_KINDS[kind], 'title', 'o nome', { max: 60 }),
      due_at: dateInput(body.dueAt, 'dueAt', 'a data'), repeat_days: number(body.repeatDays, 'repeatDays', 'o intervalo', { min: 1, max: 730, optional: true }),
      source: 'tutor', notes: body.notes ? text(body.notes, 'notes', 'a observação', { min: 0, max: 200 }) : null, created_at: now,
    });
    return { status: 201, body: { event: careView(ev, pet, now) } };
  }],

  ['POST', '/care/:id/done', ({ repo, customer, params, now }) => {
    const ev = repo.get('care', Number(params.id));
    if (!ev || ev.customer_id !== customer.id) throw new HttpError(404, 'Lembrete não encontrado.');
    const next = completeCare(repo, ev, now);
    return { next: next ? careView(next, repo.get('pets', next.pet_id), now) : null };
  }],

  ['DELETE', '/care/:id', ({ repo, customer, params }) => {
    const ev = repo.get('care', Number(params.id));
    if (!ev || ev.customer_id !== customer.id) throw new HttpError(404, 'Lembrete não encontrado.');
    repo.remove('care', ev.id);
    return { status: 204 };
  }],

  ['POST', '/appointments', ({ repo, customer, body, now, settings, hooks }) => {
    const pet = ownPet(repo, customer, body.petId);
    const slot = repo.get('slots', Number(body.slotId));
    if (!slot || slot.appointment_id || slot.starts_at <= now) throw new HttpError(409, 'Este horário acabou de ser reservado. Escolha outro.', 'slotId');
    const member = isMember(repo, customer.id, now);
    const discount = member ? Math.round((slot.price_cents * settings.clubServiceDiscount) / 100) : 0;
    const appt = repo.transaction(() => {
      const a = repo.insert('appointments', { slot_id: slot.id, customer_id: customer.id, pet_id: pet.id, service: slot.service, starts_at: slot.starts_at, price_cents: slot.price_cents, discount_cents: discount, status: 'booked', created_at: now });
      repo.update('slots', slot.id, { appointment_id: a.id });
      repo.insert('care', { customer_id: customer.id, pet_id: pet.id, kind: 'banho_tosa', title: SERVICE_LABEL[slot.service], due_at: slot.starts_at, source: 'loja', created_at: now });
      return a;
    });
    hooks.storeNotice?.(`${customer.name} agendou ${SERVICE_LABEL[slot.service]} para ${pet.name} em ${new Date(slot.starts_at).toLocaleString('pt-BR')}.`);
    return { status: 201, body: { appointment: { id: appt.id, startsAt: iso(appt.starts_at), priceCents: appt.price_cents - appt.discount_cents } } };
  }],

  ['POST', '/appointments/:id/cancel', ({ repo, customer, params }) => {
    const a = repo.get('appointments', Number(params.id));
    if (!a || a.customer_id !== customer.id || a.status !== 'booked') throw new HttpError(404, 'Agendamento não encontrado.');
    repo.update('appointments', a.id, { status: 'cancelled' });
    repo.update('slots', a.slot_id, { appointment_id: null });
    const ev = repo.all('care', { customer_id: customer.id }).find((e) => e.kind === 'banho_tosa' && e.due_at === a.starts_at && e.pet_id === a.pet_id && !e.done_at);
    if (ev) repo.remove('care', ev.id);
    return { ok: true };
  }],
];

// ======================= LOJA (painel) =======================

function customerSummary(repo, c, now) {
  const orders = repo.all('orders', { customer_id: c.id }).filter((o) => o.status === 'confirmed');
  const last = orders.sort((a, b) => b.created_at - a.created_at)[0];
  return {
    id: c.id, name: c.name, email: c.email, whatsapp: c.whatsapp ? formatWhatsApp(c.whatsapp) : null,
    pets: repo.all('pets', { customer_id: c.id }).map((p) => ({ id: p.id, name: p.name, species: p.species, color: p.color })),
    member: isMember(repo, c.id, now), orders: orders.length, spentCents: orders.reduce((s, o) => s + o.total_cents, 0),
    lastOrderAt: iso(last?.created_at), points: pointsBalance(repo.all('points', { customer_id: c.id }), now).balance, createdAt: iso(c.created_at),
  };
}

function parseProduct(b, current = {}) {
  const pick = (k, fn) => (b[k] === undefined ? current[k] : fn(b[k]));
  return {
    name: pick('name', (v) => text(v, 'name', 'o nome', { max: 80 })),
    description: pick('description', (v) => (v ? text(v, 'description', 'a descrição', { min: 0, max: 300 }) : '')),
    category: pick('category', (v) => oneOf(v, 'category', Object.keys(CATEGORY_LABEL), 'a categoria')),
    species: pick('species', (v) => oneOf(v, 'species', ['dog', 'cat', 'all'], 'a espécie')),
    tags: pick('tags', (v) => (Array.isArray(v) ? v : String(v).split(',')).map((t) => String(t).trim().toLowerCase()).filter(Boolean).slice(0, 12)),
    icon: pick('icon', (v) => String(v || '').slice(0, 20) || null),
    price_cents: pick('priceCents', (v) => Math.round(number(v, 'priceCents', 'o preço', { min: 0, max: 10_000_00 }))),
    stock: pick('stock', (v) => (v === null || v === '' ? null : Math.round(number(v, 'stock', 'o estoque', { min: 0, max: 100000 })))),
    weight_kg: pick('weightKg', (v) => number(v, 'weightKg', 'o peso', { min: 0.1, max: 50, optional: true })),
    cycle_days: pick('cycleDays', (v) => (v === null || v === '' ? null : Math.round(number(v, 'cycleDays', 'a duração', { min: 1, max: 365 })))),
    club_discount: pick('clubDiscount', (v) => (bool(v) ? 1 : 0)),
    members_only: pick('membersOnly', (v) => (bool(v) ? 1 : 0)),
    featured: pick('featured', (v) => (bool(v) ? 1 : 0)),
    is_new: pick('isNew', (v) => (bool(v) ? 1 : 0)),
    points_multiplier: pick('pointsMultiplier', (v) => number(v, 'pointsMultiplier', 'o multiplicador', { min: 0, max: 10 })),
    active: pick('active', (v) => (bool(v) ? 1 : 0)),
  };
}

const adminProduct = (p, settings) => ({ ...productView(p, { member: true, settings }), active: Boolean(p.active), clubDiscount: Boolean(p.club_discount), pointsMultiplier: p.points_multiplier });

const opportunitiesOf = (ctx) => computeOpportunities({
  customers: ctx.repo.all('customers'), pets: ctx.repo.all('pets'), orders: ctx.repo.all('orders'), care: ctx.repo.all('care'), leads: ctx.repo.all('leads'),
  actions: ctx.repo.all('opportunity_actions'), products: ctx.repo.all('products'), subscriptions: ctx.repo.all('club_subscriptions'),
  now: ctx.now, settings: ctx.settings, storeName: ctx.store.name,
});

export const storeFeatureRoutes = [
  ['GET', '/dashboard', (ctx) => {
    const { repo, now } = ctx;
    const opps = opportunitiesOf(ctx).filter((o) => o.status === 'new' || o.status === 'contacted');
    const products = repo.all('products');
    const sold = new Map();
    for (const o of repo.all('orders').filter((x) => x.status === 'confirmed' && x.created_at >= now - 30 * DAY)) {
      for (const l of o.items) sold.set(l.product_id, (sold.get(l.product_id) ?? 0) + l.qty);
    }
    return {
      metrics: dashboard({ customers: repo.all('customers'), pets: repo.all('pets'), orders: repo.all('orders'), subscriptions: repo.all('club_subscriptions'), now }),
      today: opps.slice(0, 6),
      opportunitiesOpen: opps.length,
      topProducts: [...sold.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, qty]) => ({ name: products.find((p) => p.id === id)?.name ?? '—', qty })),
      lowStock: products.filter((p) => p.active && p.stock !== null && p.stock <= 3).map((p) => ({ id: p.id, name: p.name, stock: p.stock })),
    };
  }],

  ['GET', '/opportunities', (ctx) => ({ opportunities: opportunitiesOf(ctx) })],

  ['PATCH', '/opportunities/:key', ({ repo, params, body, now }) => {
    const key = params.key;
    const status = body.status === undefined ? undefined : oneOf(body.status, 'status', ['new', 'contacted', 'won', 'dismissed'], 'o status');
    const note = body.note === undefined ? undefined : text(body.note, 'note', 'a anotação', { min: 0, max: 300 });
    if (key.startsWith('lead:')) {
      const lead = repo.get('leads', Number(key.slice(5)));
      if (!lead) throw new HttpError(404, 'Oportunidade não encontrada.');
      repo.update('leads', lead.id, { ...(status ? { status: TO_LEAD[status] } : {}), ...(note !== undefined ? { note } : {}), updated_at: now });
    } else {
      const cur = repo.all('opportunity_actions', { key })[0];
      const data = { key, status: status ?? cur?.status ?? 'new', note: note ?? cur?.note ?? '', updated_at: now };
      cur ? repo.update('opportunity_actions', cur.id, data) : repo.insert('opportunity_actions', data);
    }
    return { ok: true };
  }],

  // ----- clientes -----
  ['GET', '/customers', ({ repo, now, query }) => {
    const q = String(query.get?.('q') ?? query.q ?? '').toLowerCase();
    return {
      customers: repo.all('customers').filter((c) => !q || `${c.name} ${c.email} ${c.whatsapp ?? ''}`.toLowerCase().includes(q)).map((c) => customerSummary(repo, c, now))
        .sort((a, b) => (b.lastOrderAt ?? '').localeCompare(a.lastOrderAt ?? '')),
    };
  }],

  ['GET', '/customers/:id', ({ repo, params, now, settings }) => {
    const c = repo.get('customers', Number(params.id));
    if (!c) throw new HttpError(404, 'Cliente não encontrado.');
    const orders = repo.all('orders', { customer_id: c.id });
    const pets = repo.all('pets', { customer_id: c.id });
    return {
      customer: { ...customerSummary(repo, c, now), consentAt: iso(c.consent_at), referralCode: referralCode(c.id), whatsappLink: c.whatsapp ? whatsAppLink(c.whatsapp) : null },
      pets: pets.map((p) => ({ ...serializePet(p, now), ration: rationOf(orders, p.id, c.id) })),
      orders: orders.sort((a, b) => b.created_at - a.created_at).map((o) => orderView(o, repo)),
      points: pointsView(repo, c.id, now, settings),
      club: subView(activeSubscription(repo, c.id, now) ?? pendingSubscription(repo, c.id)),
      care: repo.all('care', { customer_id: c.id }).sort((a, b) => b.due_at - a.due_at).map((e) => careView(e, pets.find((p) => p.id === e.pet_id), now)),
    };
  }],

  // ----- produtos -----
  ['GET', '/products', ({ repo, settings }) => ({ products: repo.all('products').map((p) => adminProduct(p, settings)), categories: CATEGORY_LABEL })],
  ['POST', '/products', ({ repo, body, now, settings }) => {
    const data = parseProduct({ species: 'all', active: true, clubDiscount: true, pointsMultiplier: 1, tags: [], ...body });
    return { status: 201, body: { product: adminProduct(repo.insert('products', { ...data, created_at: now }), settings) } };
  }],
  ['PATCH', '/products/:id', ({ repo, params, body, settings }) => {
    const p = repo.get('products', Number(params.id));
    if (!p) throw new HttpError(404, 'Produto não encontrado.');
    return { product: adminProduct(repo.update('products', p.id, parseProduct(body, p)), settings) };
  }],

  // ----- pedidos -----
  ['GET', '/orders', ({ repo, query }) => {
    const status = query.get?.('status') ?? query.status;
    const customers = new Map(repo.all('customers').map((c) => [c.id, c]));
    return {
      orders: repo.all('orders').filter((o) => !status || o.status === status).sort((a, b) => b.created_at - a.created_at).slice(0, 200)
        .map((o) => ({ ...orderView(o, repo), customer: { id: o.customer_id, name: customers.get(o.customer_id)?.name ?? '—' } })),
    };
  }],
  ['POST', '/orders/quote', ({ repo, body, now, settings }) => quote(repo, { ...body, customerId: Number(body.customerId) }, { now, settings })],
  ['POST', '/orders', ({ repo, body, now, settings, hooks }) => {
    if (!repo.get('customers', Number(body.customerId))) throw new HttpError(400, 'Escolha o cliente.', 'customerId');
    const order = createOrder(repo, { ...body, customerId: Number(body.customerId), source: 'loja' }, { now, settings, hooks });
    return { status: 201, body: { order: orderView(order, repo) } };
  }],
  ['POST', '/orders/:id/confirm', ({ repo, params, now, settings, hooks }) => {
    const o = repo.get('orders', Number(params.id));
    if (!o) throw new HttpError(404, 'Pedido não encontrado.');
    return { order: orderView(repo.transaction(() => confirmOrder(repo, o, { now, settings, hooks })), repo) };
  }],
  ['POST', '/orders/:id/cancel', ({ repo, params, now, settings, hooks }) => {
    const o = repo.get('orders', Number(params.id));
    if (!o) throw new HttpError(404, 'Pedido não encontrado.');
    const out = cancelOrder(repo, o, { now, settings });
    hooks.notify?.(o.customer_id, { title: `Pedido #${o.id} cancelado`, body: 'Fale com a loja se tiver alguma dúvida.', url: '#/compras', kind: 'order' });
    return { order: orderView(out, repo) };
  }],

  // ----- clube -----
  ['GET', '/club', ({ repo, now, settings }) => {
    const customers = new Map(repo.all('customers').map((c) => [c.id, c]));
    const subs = repo.all('club_subscriptions').filter((s) => s.status !== 'cancelled').sort((a, b) => b.created_at - a.created_at);
    return {
      priceCents: settings.clubPriceCents, benefits: benefits(settings),
      subscriptions: subs.map((s) => ({ ...subView(s), active: s.status === 'active' && (!s.renews_at || s.renews_at > now), customer: { id: s.customer_id, name: customers.get(s.customer_id)?.name ?? '—', whatsapp: customers.get(s.customer_id)?.whatsapp ? formatWhatsApp(customers.get(s.customer_id).whatsapp) : null } })),
    };
  }],
  ['POST', '/club/:id/activate', ({ repo, params, now, hooks }) => {
    const s = repo.get('club_subscriptions', Number(params.id));
    if (!s || s.status === 'cancelled') throw new HttpError(404, 'Assinatura não encontrada.');
    const out = activate(repo, s, now);
    hooks.notify?.(s.customer_id, { title: 'Bem-vindo ao Clube Pet!', body: 'Seus descontos e a pontuação em dobro já estão valendo.', url: '#/clube', kind: 'club' });
    return { subscription: subView(out) };
  }],
  ['POST', '/club/:id/cancel', ({ repo, params, now }) => {
    const s = repo.get('club_subscriptions', Number(params.id));
    if (!s) throw new HttpError(404, 'Assinatura não encontrada.');
    return { subscription: subView(repo.update('club_subscriptions', s.id, { status: 'cancelled', cancelled_at: now })) };
  }],

  // ----- agenda -----
  ['GET', '/agenda', ({ repo, now }) => {
    const customers = new Map(repo.all('customers').map((c) => [c.id, c]));
    const appts = new Map(repo.all('appointments').map((a) => [a.id, a]));
    return {
      services: SERVICE_LABEL,
      slots: repo.all('slots').filter((s) => s.starts_at > now - DAY && s.starts_at < now + 21 * DAY).sort((a, b) => a.starts_at - b.starts_at).map((s) => {
        const a = s.appointment_id ? appts.get(s.appointment_id) : null;
        const c = a ? customers.get(a.customer_id) : null;
        return {
          id: s.id, service: s.service, serviceLabel: SERVICE_LABEL[s.service], startsAt: iso(s.starts_at), minutes: s.minutes, priceCents: s.price_cents,
          appointment: a && { id: a.id, status: a.status, customer: c?.name, whatsapp: c?.whatsapp ? formatWhatsApp(c.whatsapp) : null, petName: repo.get('pets', a.pet_id)?.name, priceCents: a.price_cents - a.discount_cents },
        };
      }),
    };
  }],
  ['POST', '/slots', ({ repo, body }) => {
    const service = oneOf(body.service, 'service', Object.keys(SERVICE_LABEL), 'o serviço');
    const day = String(body.date ?? '');
    const times = (Array.isArray(body.times) ? body.times : String(body.times ?? '').split(',')).map((t) => t.trim()).filter(Boolean);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !times.length || !times.every((t) => /^\d{2}:\d{2}$/.test(t))) throw new HttpError(400, 'Informe o dia e os horários (ex.: 09:00, 10:30).', 'times');
    const minutes = Math.round(number(body.minutes ?? 60, 'minutes', 'a duração', { min: 15, max: 480 }));
    const price = Math.round(number(body.priceCents, 'priceCents', 'o preço', { min: 0, max: 100000 }));
    const created = times.map((t) => repo.insert('slots', { service, starts_at: new Date(`${day}T${t}:00`).getTime(), minutes, price_cents: price, appointment_id: null }));
    return { status: 201, body: { created: created.length } };
  }],
  ['DELETE', '/slots/:id', ({ repo, params }) => {
    const s = repo.get('slots', Number(params.id));
    if (!s) throw new HttpError(404, 'Horário não encontrado.');
    if (s.appointment_id) throw new HttpError(400, 'Este horário tem agendamento. Cancele o agendamento primeiro.');
    repo.remove('slots', s.id);
    return { status: 204 };
  }],
  ['POST', '/appointments/:id/status', ({ repo, params, body, now, hooks }) => {
    const a = repo.get('appointments', Number(params.id));
    if (!a) throw new HttpError(404, 'Agendamento não encontrado.');
    const status = oneOf(body.status, 'status', ['done', 'cancelled', 'booked'], 'o status');
    repo.update('appointments', a.id, { status });
    const ev = repo.all('care', { customer_id: a.customer_id }).find((e) => e.kind === 'banho_tosa' && e.due_at === a.starts_at && e.pet_id === a.pet_id);
    if (status === 'cancelled') {
      repo.update('slots', a.slot_id, { appointment_id: null });
      if (ev && !ev.done_at) repo.remove('care', ev.id);
      hooks.notify?.(a.customer_id, { title: 'Agendamento cancelado', body: `${SERVICE_LABEL[a.service]} de ${new Date(a.starts_at).toLocaleString('pt-BR')} foi cancelado pela loja.`, url: '#/agenda', kind: 'care' });
    }
    if (status === 'done' && ev && !ev.done_at) repo.update('care', ev.id, { done_at: now });
    return { ok: true };
  }],
  // o profissional registra uma data de cuidado no histórico do pet (o app só lembra)
  ['POST', '/care', ({ repo, body, now }) => {
    const pet = repo.get('pets', Number(body.petId));
    if (!pet) throw new HttpError(404, 'Pet não encontrado.', 'petId');
    const kind = oneOf(body.kind, 'kind', Object.keys(CARE_KINDS), 'o tipo de cuidado');
    repo.insert('care', {
      customer_id: pet.customer_id, pet_id: pet.id, kind, title: text(body.title || CARE_KINDS[kind], 'title', 'o nome', { max: 60 }),
      due_at: dateInput(body.dueAt, 'dueAt', 'a data'), repeat_days: number(body.repeatDays, 'repeatDays', 'o intervalo', { min: 1, max: 730, optional: true }),
      source: 'loja', notes: body.notes ? String(body.notes).slice(0, 200) : null, created_at: now,
    });
    return { status: 201, body: { ok: true } };
  }],

  // ----- pontos, campanhas, cupons e notificações -----
  ['GET', '/marketing', ({ repo, now }) => {
    const customers = new Map(repo.all('customers').map((c) => [c.id, c.name]));
    return {
      campaigns: repo.all('campaigns').map((c) => ({ id: c.id, name: c.name, kind: c.kind, category: c.category, productId: c.product_id, multiplier: c.multiplier, startsAt: iso(c.starts_at), endsAt: iso(c.ends_at), active: Boolean(c.active), running: Boolean(c.active && (!c.starts_at || c.starts_at <= now) && (!c.ends_at || c.ends_at >= now)) })),
      coupons: repo.all('coupons').map((c) => ({ id: c.id, code: c.code, description: c.description, percent: c.percent, valueCents: c.value_cents, minCents: c.min_cents, membersOnly: Boolean(c.members_only), endsAt: iso(c.ends_at), maxUses: c.max_uses, uses: c.uses, active: Boolean(c.active) })),
      rewards: repo.all('rewards').map((r) => ({ id: r.id, name: r.name, costPoints: r.cost_points, kind: r.kind, valueCents: r.value_cents, active: Boolean(r.active) })),
      redemptions: repo.all('redemptions').sort((a, b) => b.created_at - a.created_at).slice(0, 50).map((r) => ({ code: r.code, name: r.name, status: r.status, customer: customers.get(r.customer_id) ?? '—', createdAt: iso(r.created_at) })),
      broadcasts: repo.all('broadcasts').sort((a, b) => b.created_at - a.created_at).slice(0, 20).map((b) => ({ title: b.title, body: b.body, segment: b.segment, sentCount: b.sent_count, createdAt: iso(b.created_at) })),
      pointsIssued: repo.all('points').filter((p) => p.delta > 0 && (!p.expires_at || p.expires_at > now)).reduce((s, p) => s + p.delta, 0),
    };
  }],
  ['POST', '/campaigns', ({ repo, body, now }) => {
    const kind = oneOf(body.kind, 'kind', ['categoria', 'produto', 'aniversario', 'recorrente'], 'o tipo de campanha');
    const c = repo.insert('campaigns', {
      name: text(body.name, 'name', 'o nome', { max: 80 }), kind, category: kind === 'categoria' ? oneOf(body.category, 'category', Object.keys(CATEGORY_LABEL), 'a categoria') : null,
      product_id: kind === 'produto' ? Math.round(number(body.productId, 'productId', 'o produto', { min: 1 })) : null,
      multiplier: number(body.multiplier ?? 2, 'multiplier', 'o multiplicador', { min: 1, max: 10 }),
      starts_at: body.startsAt ? dateInput(body.startsAt, 'startsAt', 'o início') : null, ends_at: body.endsAt ? dateInput(body.endsAt, 'endsAt', 'o fim') : null, active: 1, created_at: now,
    });
    return { status: 201, body: { id: c.id } };
  }],
  ['PATCH', '/campaigns/:id', ({ repo, params, body }) => {
    const c = repo.get('campaigns', Number(params.id));
    if (!c) throw new HttpError(404, 'Campanha não encontrada.');
    repo.update('campaigns', c.id, { active: bool(body.active) ? 1 : 0 });
    return { ok: true };
  }],
  ['POST', '/coupons', ({ repo, body, now }) => {
    const code = text(body.code, 'code', 'o código', { min: 3, max: 20 }).toUpperCase().replace(/\s+/g, '');
    if (repo.all('coupons').some((c) => c.code === code)) throw new HttpError(409, 'Já existe um cupom com esse código.', 'code');
    const percent = Math.round(number(body.percent ?? 0, 'percent', 'o percentual', { min: 0, max: 90 }));
    const value = Math.round(number(body.valueCents ?? 0, 'valueCents', 'o valor', { min: 0, max: 100000 }));
    if (!percent && !value) throw new HttpError(400, 'Informe um percentual ou um valor de desconto.', 'percent');
    repo.insert('coupons', {
      code, description: body.description ? String(body.description).slice(0, 120) : null, percent, value_cents: value,
      min_cents: Math.round(number(body.minCents ?? 0, 'minCents', 'o mínimo', { min: 0 })), members_only: bool(body.membersOnly) ? 1 : 0,
      ends_at: body.endsAt ? dateInput(body.endsAt, 'endsAt', 'a validade') : null, max_uses: body.maxUses ? Math.round(number(body.maxUses, 'maxUses', 'o limite', { min: 1 })) : null,
      uses: 0, active: 1, created_at: now,
    });
    return { status: 201, body: { code } };
  }],
  ['PATCH', '/coupons/:id', ({ repo, params, body }) => {
    const c = repo.get('coupons', Number(params.id));
    if (!c) throw new HttpError(404, 'Cupom não encontrado.');
    repo.update('coupons', c.id, { active: bool(body.active) ? 1 : 0 });
    return { ok: true };
  }],
  ['POST', '/rewards', ({ repo, body }) => {
    const kind = oneOf(body.kind, 'kind', ['discount', 'gift'], 'o tipo');
    repo.insert('rewards', { name: text(body.name, 'name', 'o nome', { max: 60 }), cost_points: Math.round(number(body.costPoints, 'costPoints', 'os pontos', { min: 1, max: 100000 })), kind, value_cents: Math.round(number(body.valueCents ?? 0, 'valueCents', 'o valor', { min: 0 })), active: 1 });
    return { status: 201, body: { ok: true } };
  }],
  ['PATCH', '/rewards/:id', ({ repo, params, body }) => {
    const r = repo.get('rewards', Number(params.id));
    if (!r) throw new HttpError(404, 'Recompensa não encontrada.');
    repo.update('rewards', r.id, { active: bool(body.active) ? 1 : 0 });
    return { ok: true };
  }],
  ['POST', '/redemptions/:code/use', ({ repo, params, now }) => {
    const r = repo.all('redemptions').find((x) => x.code === String(params.code).toUpperCase());
    if (!r) throw new HttpError(404, 'Código não encontrado.');
    if (r.status === 'used') throw new HttpError(400, 'Este código já foi usado.');
    repo.update('redemptions', r.id, { status: 'used', used_at: now });
    return { ok: true, name: r.name };
  }],
  ['POST', '/broadcasts', ({ repo, body, now, hooks }) => {
    const title = text(body.title, 'title', 'o título', { max: 60 });
    const msg = text(body.body, 'body', 'a mensagem', { max: 300 });
    const seg = { species: body.species ?? 'all', audience: body.audience ?? 'all' };
    const members = new Set(repo.all('club_subscriptions').filter((s) => s.status === 'active' && (!s.renews_at || s.renews_at > now)).map((s) => s.customer_id));
    const pets = repo.all('pets');
    const targets = repo.all('customers').filter((c) => {
      if (!c.consent_at) return false;
      if (seg.audience === 'club' && !members.has(c.id)) return false;
      if (seg.audience === 'non-club' && members.has(c.id)) return false;
      if (seg.species !== 'all' && !pets.some((p) => p.customer_id === c.id && p.species === seg.species)) return false;
      return true;
    });
    for (const c of targets) hooks.notify?.(c.id, { title, body: msg, url: '#/loja', kind: 'promo' });
    repo.insert('broadcasts', { title, body: msg, segment: seg, sent_count: targets.length, created_at: now });
    return { sent: targets.length };
  }],

  ['GET', '/settings', ({ settings }) => ({ settings, defaults: DEFAULT_SETTINGS })],
  ['PUT', '/settings', ({ repo, body }) => {
    const next = {};
    for (const key of Object.keys(DEFAULT_SETTINGS)) if (body[key] !== undefined) next[key] = Math.round(number(body[key], key, 'um valor válido', { min: 0, max: 10_000_000 }));
    repo.setSetting('commerce', { ...(repo.setting('commerce') ?? {}), ...next });
    return { ok: true };
  }],
];

/** Cadastro com indicação: grava quem indicou (os pontos saem só na primeira compra confirmada). */
export function registerReferral(repo, { code, customerId, now }) {
  if (!code) return;
  const clean = String(code).trim().toUpperCase();
  const referrer = repo.all('customers').find((c) => referralCode(c.id) === clean && c.id !== customerId);
  if (referrer) repo.insert('referrals', { referrer_id: referrer.id, referred_id: customerId, status: 'pending', created_at: now });
}
