import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { memoryRepo } from '../server/features/repo-memory.js';
import { pointsBalance } from '../server/features/points.js';
import { cancelOrder, confirmOrder, createOrder, quote } from '../server/features/orders.js';
import { buildShowcase } from '../server/features/showcase.js';
import { computeOpportunities } from '../server/features/opportunities.js';
import { completeCare } from '../server/features/care.js';
import { DEFAULT_SETTINGS, DAY } from '../server/features/settings.js';

const T0 = Date.UTC(2026, 4, 10, 12);
const settings = { ...DEFAULT_SETTINGS };

function world() {
  const repo = memoryRepo({});
  const maria = repo.insert('customers', { name: 'Maria Silva', email: 'm@x.com', whatsapp: '5511999998888', consent_at: T0, created_at: T0 });
  const thor = repo.insert('pets', {
    customer_id: maria.id, name: 'Thor', species: 'dog', breed_id: 'labrador', breed_name: 'Labrador', adult_kg: 30.5, color: 'Caramelo',
    birth_at: T0 - 3 * 365 * DAY, weight_kg: 30, neutered: 1, monthly_purchase_g: 15000, daily_mode: 'custom', daily_g: 400,
    stock_g: 1000, stock_at: T0, alert_days: 7, alert_state: 'low', meals_per_day: 2, created_at: T0,
  });
  const p = (data) => repo.insert('products', { species: 'all', tags: [], club_discount: 1, members_only: 0, featured: 0, is_new: 0, points_multiplier: 1, active: 1, stock: 20, created_at: T0, ...data });
  const racao = p({ name: 'Ração Premium Adulto 15 kg', category: 'racao', species: 'dog', price_cents: 25000, weight_kg: 15 });
  const brinquedo = p({ name: 'Mordedor resistente G', category: 'brinquedo', species: 'dog', tags: ['grande', 'resistente'], price_cents: 4990 });
  const areia = p({ name: 'Areia sanitária 4 kg', category: 'areia', species: 'cat', price_cents: 2990 });
  const antipulgas = p({ name: 'Antipulgas pipeta 25–40 kg', category: 'antipulgas', species: 'dog', price_cents: 8990, cycle_days: 30 });
  const exclusivo = p({ name: 'Kit aniversário', category: 'kit', species: 'dog', price_cents: 5990, members_only: 1 });
  return { repo, maria, thor, racao, brinquedo, areia, antipulgas, exclusivo };
}

const member = (repo, customerId) => repo.insert('club_subscriptions', { customer_id: customerId, status: 'active', price_cents: 1990, started_at: T0, renews_at: T0 + 30 * DAY, created_at: T0 });

describe('preço do pedido', () => {
  test('sem clube: sem desconto, 1 ponto a cada R$ 10, frete na entrega', () => {
    const { repo, maria, racao } = world();
    const q = quote(repo, { customerId: maria.id, items: [{ productId: racao.id, qty: 1 }], delivery: 'entrega' }, { now: T0, settings });
    assert.equal(q.clubDiscount, 0);
    assert.equal(q.shipping, 1200);
    assert.equal(q.total, 26200);
    assert.equal(q.pointsEarned, 25);
  });

  test('clube: 5% em produtos, frete grátis acima de R$ 150 e pontos em dobro', () => {
    const { repo, maria, racao } = world();
    member(repo, maria.id);
    const q = quote(repo, { customerId: maria.id, items: [{ productId: racao.id, qty: 1 }], delivery: 'entrega' }, { now: T0, settings });
    assert.equal(q.clubDiscount, 1250);
    assert.equal(q.shipping, 0);
    assert.equal(q.total, 23750);
    assert.equal(q.pointsEarned, 47); // 237,50 / 10 = 23,75 × 2 = 47,5
  });

  test('produto exclusivo do clube é recusado para quem não assina', () => {
    const { repo, maria, exclusivo } = world();
    assert.throws(() => quote(repo, { customerId: maria.id, items: [{ productId: exclusivo.id, qty: 1 }] }, { now: T0, settings }), /exclusivo/);
  });

  test('cupom percentual com mínimo, e 50 pontos = R$ 10 de desconto', () => {
    const { repo, maria, racao, brinquedo } = world();
    repo.insert('coupons', { code: 'VOLTA10', percent: 10, value_cents: 0, min_cents: 20000, members_only: 0, uses: 0, active: 1, created_at: T0 });
    repo.insert('points', { customer_id: maria.id, delta: 60, reason: 'teste', created_at: T0 - DAY, expires_at: T0 + 100 * DAY });
    assert.throws(() => quote(repo, { customerId: maria.id, items: [{ productId: brinquedo.id, qty: 1 }], couponCode: 'volta10' }, { now: T0, settings }), /a partir de/);
    const q = quote(repo, { customerId: maria.id, items: [{ productId: racao.id, qty: 1 }], couponCode: 'volta10', usePoints: true }, { now: T0, settings });
    assert.equal(q.couponDiscount, 2500);
    assert.equal(q.pointsDiscount, 1000);
    assert.equal(q.total, 21500);
  });

  test('campanha de pontos em dobro na categoria ração', () => {
    const { repo, maria, racao } = world();
    repo.insert('campaigns', { name: 'Ração em dobro', kind: 'categoria', category: 'racao', multiplier: 2, active: 1, created_at: T0 });
    const q = quote(repo, { customerId: maria.id, items: [{ productId: racao.id, qty: 1 }] }, { now: T0, settings });
    assert.equal(q.pointsEarned, 50);
  });
});

describe('pontos', () => {
  test('pontos vencem e o gasto consome primeiro os que vencem antes (saldo nunca fica negativo)', () => {
    const ledger = [
      { id: 1, delta: 50, created_at: T0, expires_at: T0 + 10 * DAY },
      { id: 2, delta: 30, created_at: T0 + DAY, expires_at: T0 + 400 * DAY },
      { id: 3, delta: -50, created_at: T0 + 2 * DAY, expires_at: null },
    ];
    assert.equal(pointsBalance(ledger, T0 + 3 * DAY).balance, 30);
    assert.equal(pointsBalance(ledger, T0 + 20 * DAY).balance, 30); // os 50 que venceram já tinham sido usados
    assert.equal(pointsBalance(ledger.slice(0, 2), T0 + 20 * DAY).balance, 30); // sem uso: os 50 venceram
  });
});

describe('confirmação do pedido', () => {
  test('pedido do app: baixa estoque, dá pontos, repõe a ração do pet e avisa o tutor', () => {
    const { repo, maria, thor, racao } = world();
    const calls = [];
    const hooks = { restock: (petId, kg) => calls.push(['restock', petId, kg]), notify: (id, m) => calls.push(['notify', id, m.title]) };
    const order = createOrder(repo, { customerId: maria.id, petId: thor.id, items: [{ productId: racao.id, qty: 1 }], source: 'app' }, { now: T0, settings, hooks });
    assert.equal(order.status, 'requested');
    assert.equal(repo.get('products', racao.id).stock, 20, 'pedido pendente não mexe no estoque');
    confirmOrder(repo, order, { now: T0 + 1000, settings, hooks });
    assert.equal(repo.get('products', racao.id).stock, 19);
    assert.equal(pointsBalance(repo.all('points', { customer_id: maria.id }), T0 + 2000).balance, 25);
    assert.deepEqual(calls[0], ['restock', thor.id, 15]);
    assert.match(calls[1][2], /confirmado/);
  });

  test('cancelar pedido confirmado devolve estoque e estorna os pontos; pontos usados voltam', () => {
    const { repo, maria, racao } = world();
    repo.insert('points', { customer_id: maria.id, delta: 50, reason: 'x', created_at: T0 - DAY, expires_at: T0 + 100 * DAY });
    const order = createOrder(repo, { customerId: maria.id, items: [{ productId: racao.id, qty: 1 }], usePoints: true, source: 'loja' }, { now: T0, settings, hooks: {} });
    assert.equal(order.status, 'confirmed');
    cancelOrder(repo, repo.get('orders', order.id), { now: T0 + 1000, settings });
    assert.equal(repo.get('products', racao.id).stock, 20);
    assert.equal(pointsBalance(repo.all('points', { customer_id: maria.id }), T0 + 2000).balance, 50);
  });

  test('indicação: quem indicou ganha pontos só na primeira compra confirmada do amigo', () => {
    const { repo, maria, brinquedo } = world();
    const ana = repo.insert('customers', { name: 'Ana', email: 'a@x.com', whatsapp: '5511988887777', consent_at: T0, created_at: T0 });
    repo.insert('referrals', { referrer_id: maria.id, referred_id: ana.id, status: 'pending', created_at: T0 });
    const ctx = { now: T0, settings, hooks: {} };
    createOrder(repo, { customerId: ana.id, items: [{ productId: brinquedo.id, qty: 1 }], source: 'loja' }, ctx);
    createOrder(repo, { customerId: ana.id, items: [{ productId: brinquedo.id, qty: 1 }], source: 'loja' }, ctx);
    assert.equal(pointsBalance(repo.all('points', { customer_id: maria.id }), T0 + 1).balance, settings.referralPoints);
  });
});

describe('vitrine', () => {
  test('cão grande recebe brinquedo resistente; não recebe areia de gato; antipulgas aparece perto do fim da duração', () => {
    const { repo, maria, thor, antipulgas } = world();
    createOrder(repo, { customerId: maria.id, petId: thor.id, items: [{ productId: antipulgas.id, qty: 1 }], source: 'loja' }, { now: T0 - 25 * DAY, settings, hooks: {} });
    const sections = buildShowcase({ products: repo.all('products'), pets: repo.all('pets'), orders: repo.all('orders'), member: false, now: T0, settings });
    const forThor = sections.find((s) => s.id === `pet-${thor.id}`);
    assert.ok(forThor.items.some((i) => i.name.startsWith('Mordedor')));
    assert.ok(!sections.flatMap((s) => s.items).some((i) => i.name.startsWith('Areia')));
    assert.ok(sections.find((s) => s.id === 'repor').items.some((i) => i.name.startsWith('Antipulgas')));
    assert.ok(sections.find((s) => s.id === 'complementar'), 'ração do Thor acaba em 2,5 dias');
    assert.ok(sections.find((s) => s.id === 'clube').items[0].locked);
  });
});

describe('oportunidades', () => {
  test('ração acabando é alta prioridade com mensagem pronta; cliente sumido vira recuperação', () => {
    const { repo, maria, thor, racao } = world();
    repo.insert('leads', { customer_id: maria.id, pet_id: thor.id, kind: 'low', status: 'new', days_left: 2.5, suggested_kg: 15, note: '', created_at: T0, updated_at: T0 });
    createOrder(repo, { customerId: maria.id, petId: thor.id, items: [{ productId: racao.id, qty: 1 }], source: 'loja' }, { now: T0 - 60 * DAY, settings, hooks: {} });
    const list = computeOpportunities({
      customers: repo.all('customers'), pets: repo.all('pets'), orders: repo.all('orders'), care: [], leads: repo.all('leads'), actions: [],
      products: repo.all('products'), subscriptions: [], now: T0, settings, storeName: 'Pet Shop do Bairro',
    });
    assert.equal(list[0].kind, 'alta');
    assert.match(list[0].title, /Ração acaba em 2 dias/);
    assert.match(list[0].message, /Olá, Maria! .*ração de Thor \(Ração Premium Adulto 15 kg\) está próxima de acabar.*Quer que entreguemos/);
    assert.match(list[0].whatsappLink, /^https:\/\/wa\.me\/5511999998888\?text=/);
    assert.ok(list.some((o) => o.kind === 'recuperacao' && /Sem compra há 60 dias/.test(o.title)));
  });
});

describe('agenda', () => {
  test('cuidado com repetição informada cria o próximo a partir da data em que foi feito', () => {
    const { repo, maria, thor } = world();
    const ev = repo.insert('care', { customer_id: maria.id, pet_id: thor.id, kind: 'vermifugo', title: 'Vermífugo', due_at: T0, repeat_days: 90, source: 'tutor', created_at: T0 });
    const next = completeCare(repo, ev, T0 + 2 * DAY);
    assert.equal(next.due_at, T0 + 92 * DAY);
    assert.ok(repo.get('care', ev.id).done_at);
  });
});
