// Vitrine inteligente: produtos escolhidos pelo perfil de cada pet e pelo histórico de compras
// que a LOJA registra. O tutor não precisa informar nada além do cadastro do pet.

import { findBreed } from '../data/breeds.js';
import { ageInMonths, lifeStage, sizeOf } from '../lib/nutrition.js';
import { stockStatus } from '../lib/stock.js';
import { productCycles } from './orders.js';

export const CATEGORY_LABEL = {
  racao: 'Ração', petisco: 'Petiscos', brinquedo: 'Brinquedos', higiene: 'Higiene', areia: 'Areia sanitária', sache: 'Sachês',
  antipulgas: 'Antipulgas', vermifugo: 'Vermífugos', acessorio: 'Acessórios', kit: 'Kits', servico: 'Serviços',
};

export function petProfile(pet, now) {
  const breed = findBreed(pet.breed_id);
  const size = breed?.size ?? sizeOf(pet.species, pet.adult_kg);
  const stage = lifeStage(pet.species, size, ageInMonths(pet.birth_at, now));
  return { size, stage, stock: stockStatus(pet, now) };
}

export function productView(p, { member, settings }) {
  const pct = p.category === 'servico' ? settings.clubServiceDiscount : settings.clubProductDiscount;
  return {
    id: p.id, name: p.name, description: p.description ?? '', category: p.category, categoryLabel: CATEGORY_LABEL[p.category] ?? p.category,
    species: p.species, tags: p.tags ?? [], icon: p.icon ?? p.category, priceCents: p.price_cents,
    clubPriceCents: p.club_discount ? Math.round(p.price_cents * (1 - pct / 100)) : null,
    membersOnly: Boolean(p.members_only), locked: Boolean(p.members_only && !member), featured: Boolean(p.featured), isNew: Boolean(p.is_new),
    stock: p.stock ?? null, weightKg: p.weight_kg ?? null, cycleDays: p.cycle_days ?? null,
  };
}

const fits = (p, species) => p.species === 'all' || p.species === species;
const has = (p, tag) => (p.tags ?? []).includes(tag);

/** Regras de perfil → produtos. Cada regra explica o motivo, que aparece no card. */
function forPet(pet, profile, products) {
  const pick = [];
  const add = (list, reason) => list.forEach((p) => pick.find((x) => x.p.id === p.id) || pick.push({ p, reason }));
  const sp = products.filter((p) => fits(p, pet.species) && p.category !== 'racao' && p.category !== 'servico');

  if (pet.species === 'cat') add(sp.filter((p) => p.category === 'areia' || p.category === 'sache'), 'Para gatos');
  if (pet.species === 'dog' && (profile.size === 'large' || profile.size === 'giant')) {
    add(sp.filter((p) => has(p, 'grande') || has(p, 'resistente')), 'Para cães de grande porte');
  }
  if (pet.species === 'dog' && profile.size === 'small') add(sp.filter((p) => has(p, 'pequeno')), 'Para cães de pequeno porte');
  if (profile.stage === 'puppy') add(sp.filter((p) => has(p, 'filhote')), pet.species === 'cat' ? 'Para filhotes de gato' : 'Para filhotes');
  if (profile.stage === 'senior') add(sp.filter((p) => has(p, 'senior')), 'Para pets idosos');
  return pick;
}

/**
 * @param ctx { products, pets, orders (do cliente), member, now, settings }
 * @returns seções da vitrine, já sem seções vazias
 */
export function buildShowcase({ products, pets, orders, member, now, settings }) {
  const active = products.filter((p) => p.active);
  const view = (p, reason) => ({ ...productView(p, { member, settings }), reason });
  const sections = [];
  const push = (id, title, subtitle, items, max = 8) => {
    const seen = new Set();
    const unique = items.filter(({ p }) => !seen.has(p.id) && seen.add(p.id)).slice(0, max);
    if (unique.length) sections.push({ id, title, subtitle, items: unique.map(({ p, reason }) => view(p, reason)) });
  };

  for (const pet of pets) {
    push(`pet-${pet.id}`, `Para ${pet.name}`, 'Escolhidos pelo perfil do seu pet', forPet(pet, petProfile(pet, now), active), 6);
  }

  // ração perto do fim: complementos que podem ir junto na mesma entrega
  const ending = pets.filter((pet) => petProfile(pet, now).stock.daysLeft <= 10);
  if (ending.length) {
    const sp = new Set(ending.map((p) => p.species));
    push('complementar', 'Junto com a próxima ração', `A ração de ${ending.map((p) => p.name).join(' e ')} está perto do fim`,
      active.filter((p) => ['petisco', 'sache', 'brinquedo'].includes(p.category) && (p.species === 'all' || sp.has(p.species))).map((p) => ({ p, reason: 'Aproveite a mesma entrega' })));
  }

  // quem repõe ração com frequência ganha os kits de reposição
  const rationOrders = orders.filter((o) => o.status === 'confirmed' && o.items.some((l) => l.category === 'racao'));
  if (rationOrders.length >= 2) {
    push('kits', 'Kits de reposição', 'Você repõe a ração com frequência: kits saem mais em conta',
      active.filter((p) => p.category === 'kit' && pets.some((pet) => fits(p, pet.species))).map((p) => ({ p, reason: 'Compra recorrente' })));
  }

  // produtos com duração (antipulgas, vermífugo) perto de acabar
  const cycles = productCycles(orders, products, now).filter((c) => c.daysLeft <= 10);
  push('repor', 'Hora de repor', 'Pela duração informada na embalagem do que você comprou',
    cycles.map((c) => ({ p: c.product, reason: c.daysLeft < 0 ? 'Duração da última compra já passou' : `Dura até ${new Date(c.dueAt).toLocaleDateString('pt-BR')}` })));

  const speciesOk = (p) => !pets.length || pets.some((pet) => fits(p, pet.species));
  push('destaque', 'Destaque da semana', 'Selecionado pela loja', active.filter((p) => p.featured && speciesOk(p)).map((p) => ({ p, reason: 'Destaque' })));
  push('kits-promo', 'Kits promocionais', null, active.filter((p) => p.category === 'kit' && speciesOk(p)).map((p) => ({ p, reason: 'Kit' })));
  push('novidades', 'Recém-chegados', null, active.filter((p) => p.is_new && speciesOk(p)).map((p) => ({ p, reason: 'Novidade' })));
  push('clube', 'Exclusivo do Clube Pet', member ? 'Só para assinantes' : 'Assine o clube para comprar', active.filter((p) => p.members_only && speciesOk(p)).map((p) => ({ p, reason: 'Exclusivo' })));

  // compre de novo: o que já saiu no histórico (exceto ração, que tem fluxo próprio)
  const bought = [];
  for (const o of [...orders].filter((x) => x.status === 'confirmed').sort((a, b) => b.created_at - a.created_at)) {
    for (const l of o.items) {
      const p = active.find((x) => x.id === l.product_id);
      if (p && p.category !== 'racao' && p.category !== 'servico') bought.push({ p, reason: 'Você já comprou' });
    }
  }
  push('de-novo', 'Comprar de novo', 'Do seu histórico na loja', bought);
  return sections;
}
