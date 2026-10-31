import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { seedStore } from '../server/features/demo.js';
import { sqliteRepo } from '../server/features/repo-sqlite.js';
import { startTestApp, validCustomer, validPet } from './helpers.js';

describe('módulos comerciais pela API', () => {
  let t, token, petId;
  const storeKey = 'segredo';
  before(async () => {
    t = await startTestApp();
    seedStore(sqliteRepo(t.db), t.clock.now());
    token = (await t.call('POST', '/api/customers', { body: validCustomer() })).body.token;
    petId = (await t.call('POST', '/api/pets', { token, body: validPet({ monthlyPurchaseKg: 15, stockKg: 1 }) })).body.pet.id;
  });
  after(() => t.close());

  test('rotas do tutor exigem login e as do painel exigem a senha da loja', async () => {
    assert.equal((await t.call('GET', '/api/showcase')).status, 401);
    assert.equal((await t.call('GET', '/api/store/dashboard')).status, 401);
    assert.equal((await t.call('GET', '/api/store/dashboard', { storeKey: 'errada' })).status, 401);
  });

  test('vitrine pelo perfil: Labrador recebe itens de porte grande e nada de gato', async () => {
    const { body } = await t.call('GET', '/api/showcase', { token });
    const all = body.sections.flatMap((s) => s.items);
    assert.ok(body.sections.find((s) => s.id === `pet-${petId}`).items.some((i) => i.tags.includes('grande')));
    assert.ok(!all.some((i) => i.species === 'cat'));
    assert.ok(body.sections.some((s) => s.id === 'complementar'), 'ração do Thor está no fim');
  });

  test('pedido pelo app → loja confirma → ração do pet reposta, pontos e aviso ao tutor', async () => {
    const products = (await t.call('GET', '/api/store/products', { storeKey })).body.products;
    const racao = products.find((p) => p.name.startsWith('Ração Premium Adulto Raças Grandes'));
    const quote = await t.call('POST', '/api/orders/quote', { token, body: { items: [{ productId: racao.id, qty: 1 }], petId, delivery: 'entrega' } });
    assert.equal(quote.body.total, 24990 + 1200);
    const created = await t.call('POST', '/api/orders', { token, body: { items: [{ productId: racao.id, qty: 1 }], petId, delivery: 'entrega' } });
    assert.equal(created.status, 201);
    assert.equal(created.body.order.status, 'requested');

    const before = (await t.call('GET', `/api/pets/${petId}`, { token })).body.pet.stock.kg;
    const confirmed = await t.call('POST', `/api/store/orders/${created.body.order.id}/confirm`, { storeKey });
    assert.equal(confirmed.body.order.status, 'confirmed');
    const after = (await t.call('GET', `/api/pets/${petId}`, { token })).body.pet;
    assert.equal(Math.round(after.stock.kg - before), 15);
    assert.equal(after.stock.level, 'ok');

    // R$ 249,90 (o frete não conta) com pontos em dobro pela campanha de ração da demonstração
    assert.equal((await t.call('GET', '/api/points', { token })).body.balance, 49);
    const alerts = (await t.call('GET', '/api/alerts', { token })).body.alerts;
    assert.ok(alerts.some((a) => /Pedido #\d+ confirmado/.test(a.title)));
    assert.equal((await t.call('POST', `/api/store/orders/${created.body.order.id}/confirm`, { storeKey })).status, 400, 'não confirma duas vezes');
  });

  test('trocar 50 pontos por R$ 10 gera um código que a loja dá baixa uma vez', async () => {
    const rewards = (await t.call('GET', '/api/points', { token })).body.rewards;
    const rewardId = rewards.find((x) => x.costPoints === 50).id;
    const short = await t.call('POST', '/api/points/redeem', { token, body: { rewardId } });
    assert.equal(short.status, 400);
    assert.match(short.body.error, /Faltam 1 pontos/);
    // venda no balcão (registrada pela loja) já nasce confirmada e pontua
    const bifinho = (await t.call('GET', '/api/store/products', { storeKey })).body.products.find((p) => p.name.startsWith('Bifinho'));
    const sale = await t.call('POST', '/api/store/orders', { storeKey, body: { customerId: 1, items: [{ productId: bifinho.id, qty: 1 }] } });
    assert.equal(sale.body.order.status, 'confirmed');
    assert.equal((await t.call('GET', '/api/points', { token })).body.balance, 51);
    const r = await t.call('POST', '/api/points/redeem', { token, body: { rewardId } });
    assert.match(r.body.code, /^R-/);
    assert.equal((await t.call('GET', '/api/points', { token })).body.balance, 1);
    assert.equal((await t.call('POST', `/api/store/redemptions/${r.body.code}/use`, { storeKey })).status, 200);
    assert.equal((await t.call('POST', `/api/store/redemptions/${r.body.code}/use`, { storeKey })).status, 400);
  });

  test('clube: tutor pede, loja ativa, preço com 5% aparece na cotação', async () => {
    assert.equal((await t.call('POST', '/api/club/subscribe', { token })).status, 200);
    const subs = (await t.call('GET', '/api/store/club', { storeKey })).body.subscriptions;
    await t.call('POST', `/api/store/club/${subs[0].id}/activate`, { storeKey });
    assert.equal((await t.call('GET', '/api/club', { token })).body.member, true);
    const products = (await t.call('GET', '/api/store/products', { storeKey })).body.products;
    const q = await t.call('POST', '/api/orders/quote', { token, body: { items: [{ productId: products[0].id, qty: 1 }] } });
    assert.equal(q.body.clubDiscount, Math.round(products[0].priceCents * 0.05));
  });

  test('agenda: lembrete do tutor, horário reservado com 10% do clube e o horário some para os outros', async () => {
    const ev = await t.call('POST', '/api/care', { token, body: { petId, kind: 'vermifugo', dueAt: new Date(t.clock.now() + 86_400_000).toISOString(), repeatDays: 90 } });
    assert.equal(ev.status, 201);
    const care = (await t.call('GET', '/api/care', { token })).body;
    const slot = care.slots[0];
    const booked = await t.call('POST', '/api/appointments', { token, body: { slotId: slot.id, petId } });
    assert.equal(booked.status, 201);
    assert.equal(booked.body.appointment.priceCents, Math.round(slot.priceCents * 0.9));
    assert.equal((await t.call('POST', '/api/appointments', { token, body: { slotId: slot.id, petId } })).status, 409);
    const done = await t.call('POST', `/api/care/${ev.body.event.id}/done`, { token });
    assert.ok(done.body.next, 'repetição cadastrada cria o próximo');
  });

  test('painel: indicadores, oportunidades e cliente com ração e histórico', async () => {
    await t.call('POST', `/api/pets/${petId}/stock`, { token, body: { kg: 0.5 } }); // ração quase no fim de novo
    const dash = (await t.call('GET', '/api/store/dashboard', { storeKey })).body;
    assert.equal(dash.metrics.customers, 1);
    assert.equal(dash.metrics.members, 1);
    assert.equal(dash.metrics.appOrders, 1);
    assert.equal(dash.metrics.ordersCount, 2);
    const opps = (await t.call('GET', '/api/store/opportunities', { storeKey })).body.opportunities;
    const thor = opps.find((o) => o.pet?.name === 'Thor');
    assert.equal(thor.kind, 'alta');
    assert.match(decodeURIComponent(thor.whatsappLink), /Ração Premium Adulto Raças Grandes/);
    assert.equal((await t.call('PATCH', `/api/store/opportunities/${encodeURIComponent(thor.key)}`, { storeKey, body: { status: 'contacted' } })).status, 200);
    assert.equal((await t.call('GET', '/api/store/opportunities', { storeKey })).body.opportunities.find((o) => o.key === thor.key).status, 'contacted');
    const detail = (await t.call('GET', '/api/store/customers/1', { storeKey })).body;
    assert.equal(detail.pets[0].ration.name, 'Ração Premium Adulto Raças Grandes 15 kg');
    assert.equal(detail.orders.length, 2);
  });

  test('notificação segmentada chega só para quem combina com o filtro', async () => {
    const r = await t.call('POST', '/api/store/broadcasts', { storeKey, body: { title: 'Semana do gato', body: 'Areia com 10%', species: 'cat' } });
    assert.equal(r.body.sent, 0);
    const r2 = await t.call('POST', '/api/store/broadcasts', { storeKey, body: { title: 'Semana do cão', body: 'Petiscos com 10%', species: 'dog', audience: 'club' } });
    assert.equal(r2.body.sent, 1);
  });
});
