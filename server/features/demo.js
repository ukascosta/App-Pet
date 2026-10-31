// Dados de demonstração da loja: catálogo, clientes com histórico, clube, campanhas e agenda.
// Usado pela pré-visualização e por `npm run seed`. Determinístico (mesma semente, mesmos dados).

import { findBreed } from '../data/breeds.js';
import { defaultTimes } from '../lib/feeding.js';
import { recommendationFor } from '../lib/pet-model.js';
import { confirmOrder, createOrder } from './orders.js';
import { DEFAULT_SETTINGS, DAY } from './settings.js';

const MONTH = DAY * 30.4375;

export const CATALOG = [
  ['Ração Premium Adulto Raças Grandes 15 kg', 'racao', 'dog', 24990, { weight_kg: 15, tags: ['grande'], icon: 'bag' }],
  ['Ração Premium Adulto Raças Pequenas 3 kg', 'racao', 'dog', 8990, { weight_kg: 3, tags: ['pequeno'], icon: 'bag' }],
  ['Ração Filhotes Raças Médias 10,1 kg', 'racao', 'dog', 19990, { weight_kg: 10.1, tags: ['filhote'], icon: 'bag' }],
  ['Ração Cães Sênior 7+ 10,1 kg', 'racao', 'dog', 18990, { weight_kg: 10.1, tags: ['senior'], icon: 'bag' }],
  ['Ração Gatos Castrados 10,1 kg', 'racao', 'cat', 21990, { weight_kg: 10.1, icon: 'bag' }],
  ['Ração Gatos Filhotes 3 kg', 'racao', 'cat', 7490, { weight_kg: 3, tags: ['filhote'], icon: 'bag' }],
  ['Bifinho de carne 500 g', 'petisco', 'dog', 2490, { icon: 'bone' }],
  ['Osso de couro grande (3 un.)', 'petisco', 'dog', 2990, { tags: ['grande'], icon: 'bone' }],
  ['Petisco dental sênior', 'petisco', 'dog', 3490, { tags: ['senior'], icon: 'bone' }],
  ['Mordedor de nylon resistente G', 'brinquedo', 'dog', 4990, { tags: ['grande', 'resistente'], icon: 'ball', featured: 1 }],
  ['Bolinha com guizo (porte pequeno)', 'brinquedo', 'dog', 1490, { tags: ['pequeno'], icon: 'ball' }],
  ['Tapete higiênico 30 unidades', 'higiene', 'dog', 5990, { tags: ['filhote'], icon: 'pad' }],
  ['Shampoo neutro 500 ml', 'higiene', 'all', 3290, { icon: 'drop' }],
  ['Areia sanitária bentonita 4 kg', 'areia', 'cat', 2990, { icon: 'litter' }],
  ['Areia de sílica 1,8 kg', 'areia', 'cat', 3990, { icon: 'litter', is_new: 1 }],
  ['Sachê gatos adultos (12 un.)', 'sache', 'cat', 3890, { icon: 'pouch' }],
  ['Sachê gatos filhotes (12 un.)', 'sache', 'cat', 3990, { tags: ['filhote'], icon: 'pouch' }],
  ['Arranhador poste 60 cm', 'brinquedo', 'cat', 6990, { icon: 'ball', is_new: 1 }],
  ['Antipulgas pipeta cães 25–40 kg', 'antipulgas', 'dog', 8990, { cycle_days: 30, points_multiplier: 2, icon: 'shield' }],
  ['Antipulgas comprimido cães 10–25 kg', 'antipulgas', 'dog', 11990, { cycle_days: 30, points_multiplier: 2, icon: 'shield' }],
  ['Antipulgas pipeta gatos', 'antipulgas', 'cat', 5990, { cycle_days: 30, points_multiplier: 2, icon: 'shield' }],
  ['Vermífugo cães (2 comprimidos)', 'vermifugo', 'dog', 3490, { icon: 'pill' }],
  ['Kit reposição: ração 15 kg + bifinho', 'kit', 'dog', 26490, { tags: ['reposicao', 'grande'], weight_kg: 15, icon: 'kit', featured: 1 }],
  ['Kit gato feliz: areia + sachês', 'kit', 'cat', 6490, { tags: ['reposicao'], icon: 'kit' }],
  ['Kit aniversário: bolo pet + bandana', 'kit', 'all', 5990, { members_only: 1, icon: 'gift' }],
  ['Cama pet média', 'acessorio', 'all', 12990, { icon: 'bed', featured: 1, is_new: 1 }],
];

const DESCRIPTIONS = {
  racao: 'Ração seca completa. Peso e preço por saco.',
  antipulgas: 'Siga a orientação do veterinário e a bula. A duração indicada é a da embalagem.',
  vermifugo: 'Use conforme orientação do veterinário.',
  kit: 'Combinação com preço especial.',
};

/** Linha de pet pronta para gravar, com consumo calculado pela sugestão veterinária. */
export function petRow({ customerId, name, species, breedId, color, ageMonths, weightKg = null, monthlyKg, daysLeft, now, alertState = 'ok' }) {
  const breed = findBreed(breedId);
  const base = {
    customer_id: customerId, name, species, breed_id: breed.id, breed_name: breed.name, adult_kg: breed.adultKg, color,
    birth_at: now - ageMonths * MONTH, weight_kg: weightKg, neutered: 1, kcal_per_kg: null, monthly_purchase_g: Math.round(monthlyKg * 1000),
    daily_mode: 'recommended', alert_days: 7, alert_state: alertState, created_at: now - 120 * DAY,
  };
  const rec = recommendationFor(base, now);
  return { ...base, daily_g: rec.dailyGrams, stock_g: rec.dailyGrams * daysLeft, stock_at: now, meals_per_day: rec.schedule.meals, meal_times: JSON.stringify(defaultTimes(rec.schedule.meals)) };
}

function rng(seed) {
  let s = seed;
  return () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
}

/** Catálogo, recompensas, campanhas, cupons e horários de banho e tosa. */
export function seedStore(repo, now) {
  if (repo.all('products').length) return;
  for (const [name, category, species, price, extra] of CATALOG) {
    repo.insert('products', {
      name, description: DESCRIPTIONS[category] ?? null, category, species, price_cents: price, stock: category === 'racao' ? 30 : 25,
      tags: [], club_discount: 1, members_only: 0, featured: 0, is_new: 0, points_multiplier: 1, active: 1, created_at: now - 200 * DAY, ...extra,
    });
  }
  repo.insert('rewards', { name: 'R$ 10 de desconto', cost_points: 50, kind: 'discount', value_cents: 1000, active: 1 });
  repo.insert('rewards', { name: 'Brinde: bifinho 500 g', cost_points: 100, kind: 'gift', value_cents: 2490, active: 1 });
  repo.insert('campaigns', { name: 'Pontos em dobro na ração', kind: 'categoria', category: 'racao', multiplier: 2, starts_at: now - 10 * DAY, ends_at: now + 20 * DAY, active: 1, created_at: now - 10 * DAY });
  repo.insert('campaigns', { name: 'Mês de aniversário do pet', kind: 'aniversario', multiplier: 2, active: 1, created_at: now - 60 * DAY });
  repo.insert('coupons', { code: 'VOLTA10', description: 'Recuperação de clientes', percent: 10, value_cents: 0, min_cents: 10000, members_only: 0, uses: 3, max_uses: 50, active: 1, created_at: now - 30 * DAY, ends_at: now + 30 * DAY });
  repo.insert('coupons', { code: 'CLUBE15', description: 'Exclusivo do clube', percent: 0, value_cents: 1500, min_cents: 15000, members_only: 1, uses: 1, active: 1, created_at: now - 20 * DAY });

  // horários: próximos 10 dias, de segunda a sábado
  const day0 = new Date(now);
  day0.setHours(0, 0, 0, 0);
  for (let d = 1; d <= 10; d++) {
    const date = new Date(day0.getTime() + d * DAY);
    if (date.getDay() === 0) continue;
    [['09:00', 'banho'], ['10:30', 'banho_tosa'], ['13:30', 'banho'], ['15:00', 'banho_tosa'], ['16:30', 'tosa']].forEach(([t, service]) => {
      const [h, m] = t.split(':').map(Number);
      const at = new Date(date);
      at.setHours(h, m, 0, 0);
      repo.insert('slots', { service, starts_at: at.getTime(), minutes: service === 'banho_tosa' ? 90 : 60, price_cents: service === 'banho' ? 6000 : service === 'tosa' ? 4500 : 9000, appointment_id: null });
    });
  }
}

const PEOPLE = [
  // nome, whatsapp, pet [nome, espécie, raça, cor, idade em meses, kg/mês], ração (índice entre as rações do CATALOG)
  { name: 'Mariana Souza', whatsapp: '5511987650001', pet: ['Thor', 'dog', 'labrador', 'Caramelo', 45, 15], ration: 0, every: 30, daysLeft: 2, member: true, lead: 'new' },
  { name: 'Pedro Alves', whatsapp: '5511987650002', pet: ['Bob', 'dog', 'beagle', 'Tricolor', 27, 3], ration: 1, every: 34, daysLeft: 6, lead: 'contacted' },
  { name: 'Ana Lima', whatsapp: '5511987650003', pet: ['Mel', 'cat', 'gato-srd', 'Malhado', 63, 1.8], ration: 4, every: 38, lastAgo: 52, daysLeft: 20 },
  { name: 'Lucas Pereira', whatsapp: '5511987650004', pet: ['Max', 'dog', 'pastor-alemao', 'Preto', 70, 12], ration: 0, every: 30, daysLeft: 15, antipulgas: 27 },
  { name: 'Juliana Costa', whatsapp: '5511987650005', pet: ['Luna', 'dog', 'shih-tzu', 'Branco', 12, 3], ration: 1, every: 32, daysLeft: 12, member: true },
  { name: 'Bruno Rocha', whatsapp: '5511987650006', pet: ['Rex', 'dog', 'rottweiler', 'Preto', 58, 15], ration: 0, every: 28, daysLeft: 18, member: true },
  { name: 'Carla Mendes', whatsapp: '5511987650007', pet: ['Simba', 'cat', 'maine-coon', 'Tigrado', 39, 2.5], ration: 4, every: 40, daysLeft: 25, pendingClub: true },
  { name: 'Fernanda Dias', whatsapp: '5511987650008', pet: ['Bidu', 'dog', 'poodle-medio', 'Cinza', 110, 3], ration: 3, every: 45, daysLeft: 9 },
  { name: 'Rafael Martins', whatsapp: '5511987650009', pet: ['Pipoca', 'dog', 'srd-pequeno', 'Caramelo', 4, 3], ration: 2, every: 30, daysLeft: 22, orders: 1 },
];

/** Clientes de exemplo com histórico de 4 meses, assinaturas, cuidados e agendamentos. */
export function seedCustomers(repo, now, settings = DEFAULT_SETTINGS) {
  const rand = rng(42);
  const products = repo.all('products');
  const pick = (cat, species) => products.filter((p) => p.category === cat && (p.species === species || p.species === 'all'));
  const ctx = (at) => ({ now: at, settings, hooks: {} });

  PEOPLE.forEach((person, i) => {
    const c = repo.insert('customers', {
      name: person.name, email: `${person.name.split(' ')[0].toLowerCase()}@exemplo.com`, whatsapp: person.whatsapp,
      consent_at: now - 150 * DAY, created_at: now - 150 * DAY,
    });
    const [petName, species, breedId, color, ageMonths, monthlyKg] = person.pet;
    if (person.member) repo.insert('club_subscriptions', { customer_id: c.id, status: 'active', price_cents: settings.clubPriceCents, started_at: now - 90 * DAY, renews_at: now + 12 * DAY, created_at: now - 90 * DAY });
    if (person.pendingClub) repo.insert('club_subscriptions', { customer_id: c.id, status: 'pending', price_cents: settings.clubPriceCents, created_at: now - 2 * DAY });

    const pet = repo.insert('pets', petRow({
      customerId: c.id, name: petName, species, breedId, color, ageMonths, monthlyKg, daysLeft: person.daysLeft, now,
      alertState: person.daysLeft <= 7 ? 'low' : 'ok',
    }));
    if (person.lead) {
      repo.insert('leads', { customer_id: c.id, pet_id: pet.id, kind: 'low', status: person.lead, days_left: person.daysLeft, suggested_kg: monthlyKg, note: person.lead === 'contacted' ? 'Mandei mensagem às 10h' : '', created_at: now - DAY, updated_at: now - DAY });
    }

    // histórico: ração a cada `every` dias, às vezes com extras; parte pelo app
    const ration = products.filter((p) => p.category === 'racao')[person.ration];
    const last = now - (person.lastAgo ?? person.every - person.daysLeft) * DAY;
    const count = person.orders ?? Math.max(1, Math.floor(120 / person.every));
    for (let k = count - 1; k >= 0; k--) {
      const at = last - k * person.every * DAY;
      const items = [{ productId: ration.id, qty: 1 }];
      const extra = [...pick('petisco', species), ...pick('sache', species), ...pick('areia', species), ...pick('brinquedo', species)];
      if (extra.length && rand() < 0.6) items.push({ productId: extra[Math.floor(rand() * extra.length)].id, qty: 1 + Math.floor(rand() * 2) });
      const source = rand() < 0.45 + k * -0.05 ? 'app' : 'loja';
      const order = createOrder(repo, { customerId: c.id, petId: pet.id, items, source, delivery: rand() < 0.5 ? 'entrega' : 'retirada' }, ctx(at));
      if (order.status === 'requested') confirmOrder(repo, order, ctx(at + 3 * 3600_000));
    }
    if (person.antipulgas) {
      const ap = pick('antipulgas', species)[0];
      confirmOrder(repo, createOrder(repo, { customerId: c.id, petId: pet.id, items: [{ productId: ap.id, qty: 1 }], source: 'app' }, ctx(now - person.antipulgas * DAY)), ctx(now - person.antipulgas * DAY + 3600_000));
    }
    // devolve o estoque à situação do cenário (os pedidos antigos não devem mudar o que está em casa hoje)
    repo.update('pets', pet.id, { stock_g: pet.daily_g * person.daysLeft, stock_at: now });

    if (i === 4) repo.insert('care', { customer_id: c.id, pet_id: pet.id, kind: 'vacina', title: 'Vacina V10 (reforço anual)', due_at: now + 5 * DAY, repeat_days: 365, source: 'loja', notes: 'Data informada pela clínica parceira', created_at: now - 30 * DAY });
    if (i === 7) repo.insert('care', { customer_id: c.id, pet_id: pet.id, kind: 'vermifugo', title: 'Vermífugo', due_at: now + 2 * DAY, repeat_days: 90, source: 'tutor', created_at: now - 80 * DAY });
    if (i === 0) {
      const slot = repo.all('slots').find((s) => s.service === 'banho_tosa' && s.starts_at > now + DAY);
      if (slot) {
        const a = repo.insert('appointments', { slot_id: slot.id, customer_id: c.id, pet_id: pet.id, service: slot.service, starts_at: slot.starts_at, price_cents: slot.price_cents, discount_cents: Math.round(slot.price_cents * 0.1), status: 'booked', created_at: now - DAY });
        repo.update('slots', slot.id, { appointment_id: a.id });
        repo.insert('care', { customer_id: c.id, pet_id: pet.id, kind: 'banho_tosa', title: 'Banho e tosa', due_at: slot.starts_at, source: 'loja', created_at: now - DAY });
      }
    }
  });
  // um pedido do app esperando a loja confirmar
  const rafael = repo.all('customers').find((c) => c.name.startsWith('Rafael'));
  const tapete = products.find((p) => p.name.startsWith('Tapete'));
  if (rafael && tapete) createOrder(repo, { customerId: rafael.id, petId: repo.all('pets', { customer_id: rafael.id })[0].id, items: [{ productId: tapete.id, qty: 2 }], source: 'app', delivery: 'entrega' }, ctx(now - 2 * 3600_000));
}

/** Tutor de exemplo (Maria): Thor e Mia, com compras na loja para a vitrine e os pontos terem o que mostrar. */
export function seedDemoTutor(repo, customerId, now, { thorDays = 21, miaDays = 20, settings = DEFAULT_SETTINGS } = {}) {
  const thor = repo.insert('pets', petRow({ customerId, name: 'Thor', species: 'dog', breedId: 'labrador', color: 'Caramelo', ageMonths: 39, weightKg: 30, monthlyKg: 15, daysLeft: thorDays, now, alertState: thorDays <= 7 ? (thorDays <= 0 ? 'empty' : 'low') : 'ok' }));
  const mia = repo.insert('pets', petRow({ customerId, name: 'Mia', species: 'cat', breedId: 'siames', color: 'Cinza', ageMonths: 26, weightKg: 4, monthlyKg: 1.8, daysLeft: miaDays, now, alertState: miaDays <= 7 ? (miaDays <= 0 ? 'empty' : 'low') : 'ok' }));
  const products = repo.all('products');
  const find = (prefix) => products.find((p) => p.name.startsWith(prefix));
  const ctx = (at) => ({ now: at, settings, hooks: {} });
  const buy = (daysAgo, petId, items, source = 'loja') => {
    const at = now - daysAgo * DAY;
    const o = createOrder(repo, { customerId, petId, items: items.map(([prefix, qty]) => ({ productId: find(prefix).id, qty })), source }, ctx(at));
    if (o.status === 'requested') confirmOrder(repo, o, ctx(at + 3600_000));
  };
  buy(40, thor.id, [['Ração Premium Adulto Raças Grandes', 1], ['Bifinho', 1]]);
  buy(33, mia.id, [['Areia sanitária bentonita', 2], ['Sachê gatos adultos', 1]], 'app');
  buy(26, thor.id, [['Antipulgas pipeta cães 25–40', 1]]);
  buy(12, thor.id, [['Ração Premium Adulto Raças Grandes', 1]], 'app');
  // o estoque de hoje é o do cenário, não o somado das compras antigas
  repo.update('pets', thor.id, { stock_g: thor.daily_g * thorDays, stock_at: now });
  repo.update('pets', mia.id, { stock_g: mia.daily_g * miaDays, stock_at: now });
  return { thor: repo.get('pets', thor.id), mia: repo.get('pets', mia.id) };
}
