// Pedidos: orçamento (com clube, cupom, pontos e frete), criação, confirmação e cancelamento.
// Pedidos feitos no app ficam "requested" até a loja confirmar; vendas no balcão já nascem confirmadas.

import { HttpError } from '../lib/validate.js';
import { isMember } from './club.js';
import { balanceOf, grantPoints } from './points.js';
import { DAY, money } from './settings.js';

const SERVICE = 'servico';

/** Maior multiplicador de campanha ativo para um item (categoria, produto, aniversário do pet, cliente recorrente). */
export function campaignMultiplier(campaigns, { product, now, birthdayMonth, recurring }) {
  let best = 1;
  for (const c of campaigns) {
    if (!c.active || (c.starts_at && c.starts_at > now) || (c.ends_at && c.ends_at < now)) continue;
    const hit =
      (c.kind === 'categoria' && c.category === product.category) ||
      (c.kind === 'produto' && c.product_id === product.id) ||
      (c.kind === 'aniversario' && birthdayMonth) ||
      (c.kind === 'recorrente' && recurring);
    if (hit) best = Math.max(best, c.multiplier);
  }
  return best;
}

function couponDiscount(coupon, base, member, now) {
  if (!coupon) return 0;
  if (!coupon.active || (coupon.ends_at && coupon.ends_at < now) || (coupon.max_uses && coupon.uses >= coupon.max_uses)) {
    throw new HttpError(400, 'Este cupom expirou ou não está mais disponível.', 'couponCode');
  }
  if (coupon.members_only && !member) throw new HttpError(400, 'Este cupom é exclusivo para quem é do Clube Pet.', 'couponCode');
  if (base < coupon.min_cents) throw new HttpError(400, `Este cupom vale para compras a partir de ${money(coupon.min_cents)}.`, 'couponCode');
  return Math.min(base, coupon.percent ? Math.round((base * coupon.percent) / 100) : coupon.value_cents);
}

/**
 * Calcula um pedido sem gravar nada.
 * @param input { customerId, items:[{productId, qty}], petId?, usePoints?, couponCode?, delivery: 'retirada'|'entrega' }
 */
export function quote(repo, input, { now, settings }) {
  const member = isMember(repo, input.customerId, now);
  if (!Array.isArray(input.items) || !input.items.length) throw new HttpError(400, 'Escolha pelo menos um produto.', 'items');

  const confirmed = repo.all('orders', { customer_id: input.customerId }).filter((o) => o.status === 'confirmed');
  const recurring = confirmed.length >= 3;
  const pet = input.petId ? repo.get('pets', Number(input.petId)) : null;
  const birthdayMonth = Boolean(pet && new Date(pet.birth_at).getMonth() === new Date(now).getMonth());
  const campaigns = repo.all('campaigns');

  const lines = input.items.map(({ productId, qty }) => {
    const product = repo.get('products', Number(productId));
    const q = Math.round(Number(qty));
    if (!product || !product.active) throw new HttpError(400, 'Um dos produtos não está mais disponível.', 'items');
    if (!(q >= 1 && q <= 50)) throw new HttpError(400, 'Quantidade inválida.', 'items');
    if (product.members_only && !member) throw new HttpError(403, `${product.name} é exclusivo para o Clube Pet.`, 'items');
    if (product.stock !== null && product.stock !== undefined && product.stock < q) {
      throw new HttpError(400, `Só temos ${product.stock} unidade(s) de ${product.name} agora.`, 'items');
    }
    const gross = product.price_cents * q;
    const pct = product.category === SERVICE ? settings.clubServiceDiscount : settings.clubProductDiscount;
    const club = member && product.club_discount ? Math.round((gross * pct) / 100) : 0;
    const mult = product.points_multiplier * campaignMultiplier(campaigns, { product, now, birthdayMonth, recurring });
    return { product_id: product.id, name: product.name, category: product.category, qty: q, unit_cents: product.price_cents, club_discount_cents: club, points_multiplier: mult, weight_kg: product.weight_kg ?? null };
  });

  const subtotal = lines.reduce((s, l) => s + l.unit_cents * l.qty, 0);
  const clubDiscount = lines.reduce((s, l) => s + l.club_discount_cents, 0);
  let base = subtotal - clubDiscount;

  const code = String(input.couponCode ?? '').trim().toUpperCase();
  const coupon = code ? repo.all('coupons').find((c) => c.code === code) : null;
  if (code && !coupon) throw new HttpError(400, 'Cupom não encontrado.', 'couponCode');
  const couponOff = couponDiscount(coupon, base, member, now);
  base -= couponOff;

  let pointsUsed = 0;
  let pointsOff = 0;
  const balance = balanceOf(repo, input.customerId, now);
  if (input.usePoints) {
    if (balance < settings.pointsDiscountBlock) throw new HttpError(400, `Você precisa de ${settings.pointsDiscountBlock} pontos para usar o desconto.`, 'usePoints');
    if (base < settings.pointsDiscountCents) throw new HttpError(400, `O desconto de pontos vale para compras a partir de ${money(settings.pointsDiscountCents)}.`, 'usePoints');
    pointsUsed = settings.pointsDiscountBlock;
    pointsOff = settings.pointsDiscountCents;
    base -= pointsOff;
  }

  const delivery = input.delivery === 'entrega' ? 'entrega' : 'retirada';
  const freeShipping = member && base >= settings.freeShippingMinCents;
  const shipping = delivery === 'entrega' && !freeShipping ? settings.shippingCents : 0;
  const total = base + shipping;

  // pontos: proporcionais ao valor pago por item (depois dos descontos), com multiplicadores
  const net = subtotal - clubDiscount;
  const ratio = net > 0 ? base / net : 0;
  const raw = lines.reduce((s, l) => s + ((l.unit_cents * l.qty - l.club_discount_cents) * ratio * l.points_multiplier) / settings.centsPerPoint, 0);
  const pointsEarned = Math.floor(raw * (member ? settings.clubPointsMultiplier : 1));

  return {
    member, lines, delivery, subtotal, clubDiscount, couponDiscount: couponOff, couponCode: coupon?.code ?? null,
    pointsUsed, pointsDiscount: pointsOff, pointsBalance: balance, shipping, freeShipping, total, pointsEarned,
    canUsePoints: balance >= settings.pointsDiscountBlock,
  };
}

export function createOrder(repo, input, ctx) {
  const q = quote(repo, input, ctx);
  const { now } = ctx;
  return repo.transaction(() => {
    const order = repo.insert('orders', {
      customer_id: input.customerId, pet_id: input.petId ? Number(input.petId) : null, source: input.source, status: 'requested',
      items: q.lines, subtotal_cents: q.subtotal, discount_cents: q.clubDiscount + q.couponDiscount + q.pointsDiscount,
      shipping_cents: q.shipping, total_cents: q.total, points_used: q.pointsUsed, points_earned: q.pointsEarned,
      coupon_code: q.couponCode, delivery: q.delivery, note: input.note ? String(input.note).slice(0, 300) : null, created_at: now,
    });
    if (q.pointsUsed) grantPoints(repo, { customerId: input.customerId, points: -q.pointsUsed, reason: `Desconto no pedido #${order.id}`, orderId: order.id, now, settings: ctx.settings });
    return input.source === 'loja' ? confirmOrder(repo, order, ctx) : order;
  });
}

/** Confirma: baixa estoque, dá pontos, conta o cupom, paga a indicação e repõe a ração do pet. */
export function confirmOrder(repo, order, { now, settings, hooks }) {
  if (order.status !== 'requested') throw new HttpError(400, 'Este pedido já foi tratado.');
  const updated = repo.update('orders', order.id, { status: 'confirmed', confirmed_at: now });

  for (const line of order.items) {
    const p = repo.get('products', line.product_id);
    if (p && p.stock !== null && p.stock !== undefined) repo.update('products', p.id, { stock: Math.max(0, p.stock - line.qty) });
  }
  grantPoints(repo, { customerId: order.customer_id, points: order.points_earned, reason: `Compra #${order.id}`, orderId: order.id, now, settings });
  if (order.coupon_code) {
    const c = repo.all('coupons').find((x) => x.code === order.coupon_code);
    if (c) repo.update('coupons', c.id, { uses: c.uses + 1 });
  }

  // indicação: só depois da primeira compra confirmada do indicado
  const firstConfirmed = repo.all('orders', { customer_id: order.customer_id }).filter((o) => o.status === 'confirmed').length === 1;
  const ref = firstConfirmed && repo.all('referrals', { referred_id: order.customer_id }).find((r) => r.status === 'pending');
  if (ref) {
    repo.update('referrals', ref.id, { status: 'rewarded' });
    grantPoints(repo, { customerId: ref.referrer_id, points: settings.referralPoints, reason: 'Indicação de amigo', now, settings });
    hooks?.notify?.(ref.referrer_id, { title: 'Você ganhou pontos por indicação', body: `+${settings.referralPoints} pontos: seu amigo fez a primeira compra.`, url: '#/pontos', kind: 'points' });
  }

  // ração com peso conhecido repõe o estoque do pet (o tutor não precisa registrar nada)
  const kg = order.items.filter((l) => l.category === 'racao' && l.weight_kg).reduce((s, l) => s + l.weight_kg * l.qty, 0);
  const petId = order.pet_id ?? ownPetFor(repo, order);
  if (kg && petId) hooks?.restock?.(petId, kg);

  hooks?.notify?.(order.customer_id, {
    title: `Pedido #${order.id} confirmado`,
    body: `${money(order.total_cents)}${order.points_earned ? ` · +${order.points_earned} pontos` : ''}. Obrigado por comprar com a gente!`,
    url: '#/compras',
    kind: 'order',
  });
  return updated;
}

/** Sem pet indicado: usa o único pet da espécie da ração (se houver só um). */
function ownPetFor(repo, order) {
  const pets = repo.all('pets', { customer_id: order.customer_id });
  if (pets.length === 1) return pets[0].id;
  const species = order.items.map((l) => repo.get('products', l.product_id)?.species).find((s) => s === 'dog' || s === 'cat');
  const same = pets.filter((p) => p.species === species);
  return same.length === 1 ? same[0].id : null;
}

export function cancelOrder(repo, order, { now, settings }) {
  if (order.status === 'cancelled') throw new HttpError(400, 'Este pedido já foi cancelado.');
  return repo.transaction(() => {
    if (order.points_used) grantPoints(repo, { customerId: order.customer_id, points: order.points_used, reason: `Devolução de pontos do pedido #${order.id}`, orderId: order.id, now, settings });
    if (order.status === 'confirmed') {
      for (const line of order.items) {
        const p = repo.get('products', line.product_id);
        if (p && p.stock !== null && p.stock !== undefined) repo.update('products', p.id, { stock: p.stock + line.qty });
      }
      if (order.points_earned) grantPoints(repo, { customerId: order.customer_id, points: -order.points_earned, reason: `Estorno do pedido #${order.id}`, orderId: order.id, now, settings });
    }
    return repo.update('orders', order.id, { status: 'cancelled' });
  });
}

/** Última data em que cada produto com duração informada (ex.: antipulgas de 30 dias) foi comprado, e a próxima reposição. */
export function productCycles(orders, products, now) {
  const byId = new Map(products.map((p) => [p.id, p]));
  const latest = new Map();
  for (const o of orders.filter((x) => x.status === 'confirmed')) {
    for (const l of o.items) {
      const p = byId.get(l.product_id);
      if (!p?.cycle_days) continue;
      const key = `${o.customer_id}:${p.id}`;
      const at = o.confirmed_at ?? o.created_at;
      if (!latest.has(key) || latest.get(key).boughtAt < at) latest.set(key, { customerId: o.customer_id, petId: o.pet_id, orderId: o.id, product: p, boughtAt: at });
    }
  }
  return [...latest.values()].map((c) => ({ ...c, dueAt: c.boughtAt + c.product.cycle_days * DAY, daysLeft: Math.round((c.boughtAt + c.product.cycle_days * DAY - now) / DAY) }));
}
