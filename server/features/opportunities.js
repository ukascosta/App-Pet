// CRM de oportunidades: lista automática de clientes que precisam de uma ação comercial hoje.
// Cada oportunidade traz a mensagem pronta para o WhatsApp.

import { formatWhatsApp, whatsAppLink } from '../lib/phone.js';
import { stockStatus } from '../lib/stock.js';
import { careStatus, CARE_KINDS } from './care.js';
import { productCycles } from './orders.js';
import { DAY } from './settings.js';

export const KIND_LABEL = {
  alta: 'Alta prioridade', reposicao: 'Reposição prevista', recuperacao: 'Recuperação', complementar: 'Oferta complementar', aniversario: 'Aniversário',
};
const RANK = { alta: 0, recuperacao: 1, reposicao: 2, complementar: 3, aniversario: 4 };
export const STATUS_LABEL = { new: 'Nova', contacted: 'Aguardando resposta', won: 'Vendida', dismissed: 'Descartada' };
// as oportunidades de ração usam o pedido de reposição (leads) que o alerta já cria
const LEAD_STATUS = { new: 'new', contacted: 'contacted', sold: 'won', closed: 'dismissed' };
export const TO_LEAD = { new: 'new', contacted: 'contacted', won: 'sold', dismissed: 'closed' };

const first = (name) => String(name).split(' ')[0];
const dateBR = (t) => new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
const whenText = (days) => (days <= 0 ? 'hoje' : days === 1 ? 'amanhã' : `em ${days} dias`);

/** Ração que o pet consome, pelo histórico de compras (a última com peso informado). */
export function rationOf(orders, petId, customerId) {
  const list = orders
    .filter((o) => o.status === 'confirmed' && o.customer_id === customerId && (o.pet_id === petId || o.pet_id === null))
    .sort((a, b) => b.created_at - a.created_at);
  for (const o of list) {
    const line = o.items.find((l) => l.category === 'racao');
    if (line) return { name: line.name, productId: line.product_id, unitCents: line.unit_cents, at: o.created_at };
  }
  return null;
}

export function computeOpportunities({ customers, pets, orders, care, leads, actions, products, subscriptions, now, settings, storeName }) {
  const byCustomer = new Map(customers.map((c) => [c.id, c]));
  const actionOf = new Map(actions.map((a) => [a.key, a]));
  const out = [];
  const add = (o) => {
    const c = byCustomer.get(o.customerId);
    if (!c?.whatsapp) return;
    const act = o.lead ? null : actionOf.get(o.key);
    const status = o.lead ? LEAD_STATUS[o.lead.status] : act?.status ?? 'new';
    out.push({
      key: o.key, kind: o.kind, kindLabel: KIND_LABEL[o.kind], status, statusLabel: STATUS_LABEL[status], note: o.lead ? o.lead.note : act?.note ?? '',
      customer: { id: c.id, name: c.name, whatsapp: formatWhatsApp(c.whatsapp) }, pet: o.pet ? { id: o.pet.id, name: o.pet.name, species: o.pet.species, color: o.pet.color } : null,
      title: o.title, detail: o.detail, dueAt: o.dueAt ? new Date(o.dueAt).toISOString() : null, valueCents: o.valueCents ?? null,
      message: o.message, whatsappLink: whatsAppLink(c.whatsapp, o.message),
    });
  };

  // 1) ração: pedidos de reposição abertos (o alerta do app já os cria)
  for (const lead of leads.filter((l) => l.status === 'new' || l.status === 'contacted')) {
    const pet = pets.find((p) => p.id === lead.pet_id);
    if (!pet) continue;
    const c = byCustomer.get(pet.customer_id);
    const st = stockStatus(pet, now);
    const days = Math.max(0, Math.floor(Math.round(st.daysLeft * 10) / 10));
    const ration = rationOf(orders, pet.id, pet.customer_id);
    const product = ration ? ` (${ration.name})` : '';
    const empty = st.level === 'empty';
    const since = empty ? Math.floor((now - st.runsOutAt) / DAY) : 0;
    const kind = empty && since > 7 ? 'recuperacao' : days <= 3 ? 'alta' : 'reposicao';
    add({
      key: `lead:${lead.id}`, lead, kind, customerId: pet.customer_id, pet,
      title: empty ? (since > 0 ? `Ração acabou há ${since} ${since === 1 ? 'dia' : 'dias'}` : 'Ração acabou') : days <= 3 ? `Ração acaba em ${days} ${days === 1 ? 'dia' : 'dias'}` : `Reposição prevista ${whenText(days)} (${dateBR(st.runsOutAt)})`,
      detail: `Compra ${(pet.monthly_purchase_g / 1000).toLocaleString('pt-BR')} kg por mês${product}`,
      dueAt: st.runsOutAt, valueCents: ration?.unitCents,
      message: `Olá, ${first(c?.name ?? '')}! Tudo bem? A ração de ${pet.name}${product} ${empty ? 'acabou' : 'está próxima de acabar'}. Já deixamos uma unidade separada para você. Quer que entreguemos? (${storeName})`,
    });
  }

  // 2) recuperação: clientes que compravam e sumiram
  for (const c of customers) {
    const confirmed = orders.filter((o) => o.customer_id === c.id && o.status === 'confirmed').sort((a, b) => b.created_at - a.created_at);
    if (!confirmed.length) continue;
    const last = confirmed[0];
    const days = Math.floor((now - last.created_at) / DAY);
    if (days < settings.recoveryDays) continue;
    const pet = pets.find((p) => p.customer_id === c.id);
    add({
      key: `rec:${c.id}:${last.id}`, kind: 'recuperacao', customerId: c.id, pet,
      title: `Sem compra há ${days} dias`, detail: `Última compra: ${dateBR(last.created_at)}, R$ ${(last.total_cents / 100).toFixed(2).replace('.', ',')}`,
      dueAt: last.created_at,
      message: `Olá, ${first(c.name)}! Sentimos sua falta aqui na ${storeName}. ${pet ? `Como está ${pet.name}? ` : ''}Separamos uma condição especial para a sua próxima compra. Posso te contar?`,
    });
  }

  // 3) oferta complementar: cuidados cadastrados e produtos com duração perto do fim
  // banho já agendado na loja não é oportunidade (já é venda)
  for (const ev of care.filter((e) => !e.done_at && !(e.kind === 'banho_tosa' && e.source === 'loja') && ['soon', 'today', 'late'].includes(careStatus(e, now)))) {
    const pet = pets.find((p) => p.id === ev.pet_id);
    const c = byCustomer.get(ev.customer_id);
    if (!pet || !c) continue;
    const label = CARE_KINDS[ev.kind] ?? ev.title;
    add({
      key: `care:${ev.id}`, kind: 'complementar', customerId: c.id, pet,
      title: `${label} de ${pet.name} ${ev.due_at < now ? `(data passou: ${dateBR(ev.due_at)})` : `em ${dateBR(ev.due_at)}`}`, detail: 'Data cadastrada pelo tutor ou profissional',
      dueAt: ev.due_at,
      message: ev.kind === 'banho_tosa'
        ? `Olá, ${first(c.name)}! O banho de ${pet.name} está chegando (${dateBR(ev.due_at)}). Quer que a gente reserve um horário?`
        : `Olá, ${first(c.name)}! Vi que o ${label.toLowerCase()} de ${pet.name} está marcado para ${dateBR(ev.due_at)}. Temos os produtos aqui na loja, se precisar.`,
    });
  }
  for (const cy of productCycles(orders, products, now).filter((x) => x.daysLeft <= 7)) {
    const c = byCustomer.get(cy.customerId);
    if (!c) continue;
    const pet = pets.find((p) => p.id === cy.petId) ?? pets.find((p) => p.customer_id === c.id && (cy.product.species === 'all' || p.species === cy.product.species));
    add({
      key: `cycle:${cy.orderId}:${cy.product.id}`, kind: 'complementar', customerId: c.id, pet,
      title: `${cy.product.name} ${cy.daysLeft < 0 ? 'venceu' : `vence ${whenText(cy.daysLeft)}`}`, detail: `Comprado em ${dateBR(cy.boughtAt)}; duração de ${cy.product.cycle_days} dias pela embalagem`,
      dueAt: cy.dueAt, valueCents: cy.product.price_cents,
      message: `Olá, ${first(c.name)}! O ${cy.product.name} que você levou em ${dateBR(cy.boughtAt)} ${cy.daysLeft < 0 ? 'já passou' : 'está perto'} do fim da duração indicada na embalagem. Quer que separemos outro${pet ? ` para ${pet.name}` : ''}?`,
    });
  }

  // 4) aniversário do pet (assinantes do clube ganham brinde)
  const members = new Set(subscriptions.filter((s) => s.status === 'active' && (!s.renews_at || s.renews_at > now)).map((s) => s.customer_id));
  const month = new Date(now).getMonth();
  for (const pet of pets.filter((p) => members.has(p.customer_id) && new Date(p.birth_at).getMonth() === month)) {
    const c = byCustomer.get(pet.customer_id);
    add({
      key: `bday:${pet.id}:${new Date(now).getFullYear()}`, kind: 'aniversario', customerId: pet.customer_id, pet,
      title: `${pet.name} faz aniversário este mês`, detail: 'Brinde do Clube Pet', dueAt: null,
      message: `Olá, ${first(c.name)}! Este mês é aniversário de ${pet.name} 🎉 Como você é do Clube Pet, tem um brinde esperando aqui na ${storeName}.`,
    });
  }

  return out.sort((a, b) => RANK[a.kind] - RANK[b.kind] || (a.dueAt ?? '').localeCompare(b.dueAt ?? ''));
}
