import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { startTestApp, validCustomer, validPet } from './helpers.js';

describe('cadastro e login', () => {
  let t;
  before(async () => { t = await startTestApp(); });
  after(() => t.close());

  test('cadastra o cliente e normaliza o WhatsApp', async () => {
    const res = await t.call('POST', '/api/customers', { body: validCustomer() });
    assert.equal(res.status, 201);
    assert.equal(res.body.customer.whatsapp, '5511999998888');
    assert.ok(res.body.token);
  });

  test('exige autorização de contato (LGPD), e-mail e WhatsApp válidos', async () => {
    const noConsent = await t.call('POST', '/api/customers', { body: validCustomer({ email: 'a@b.com', whatsapp: '11977776666', consent: false }) });
    assert.equal(noConsent.status, 400);
    assert.equal(noConsent.body.field, 'consent');
    const badMail = await t.call('POST', '/api/customers', { body: validCustomer({ email: 'x' }) });
    assert.equal(badMail.body.field, 'email');
    const badPhone = await t.call('POST', '/api/customers', { body: validCustomer({ email: 'c@d.com', whatsapp: '123' }) });
    assert.equal(badPhone.body.field, 'whatsapp');
  });

  test('não permite e-mail ou WhatsApp repetidos', async () => {
    const dupMail = await t.call('POST', '/api/customers', { body: validCustomer({ whatsapp: '11955554444' }) });
    assert.equal(dupMail.status, 409);
    const dupPhone = await t.call('POST', '/api/customers', { body: validCustomer({ email: 'outra@example.com' }) });
    assert.equal(dupPhone.status, 409);
  });

  test('entra de novo com e-mail + senha e recusa senha errada', async () => {
    const ok = await t.call('POST', '/api/session', { body: { email: 'MARIA@example.com', password: 'senha-segura-1' } });
    assert.equal(ok.status, 200);
    const me = await t.call('GET', '/api/me', { token: ok.body.token });
    assert.equal(me.body.customer.name, 'Maria Silva');
    const wrong = await t.call('POST', '/api/session', { body: { email: 'maria@example.com', password: 'outra-senha-1' } });
    assert.equal(wrong.status, 401);
  });

  test('rotas do tutor exigem login', async () => {
    assert.equal((await t.call('GET', '/api/me')).status, 401);
    assert.equal((await t.call('GET', '/api/me', { token: 'inventado' })).status, 401);
  });
});

describe('pets e prévia da sugestão', () => {
  let t, token;
  before(async () => {
    t = await startTestApp();
    token = (await t.call('POST', '/api/customers', { body: validCustomer() })).body.token;
  });
  after(() => t.close());

  test('lista raças por espécie', async () => {
    const dogs = await t.call('GET', '/api/breeds?species=dog');
    const cats = await t.call('GET', '/api/breeds?species=cat');
    assert.ok(dogs.body.length > 90 && dogs.body.every((b) => b.species === 'dog'));
    assert.ok(cats.body.length > 25 && cats.body.every((b) => b.species === 'cat'));
  });

  test('prévia da sugestão sem login', async () => {
    const res = await t.call('POST', '/api/recommendation', { body: { species: 'dog', breedId: 'labrador', ageYears: 3, weightKg: 30 } });
    assert.equal(res.status, 200);
    assert.equal(res.body.dailyGrams, 380);
    assert.equal(res.body.monthlyKg, 11.4);
  });

  test('cadastra pet com a sugestão como consumo e estoque = compra mensal', async () => {
    const res = await t.call('POST', '/api/pets', { token, body: validPet() });
    assert.equal(res.status, 201);
    const { pet } = res.body;
    assert.equal(pet.dailyGrams, 380);
    assert.equal(pet.stock.kg, 10);
    assert.equal(pet.stock.level, 'ok');
    assert.equal(pet.stock.daysLeft, 26.3);
    assert.equal(pet.ageMonths, 36);
  });

  test('modo "pelo que eu compro" e modo personalizado', async () => {
    const purchase = await t.call('POST', '/api/pets', { token, body: validPet({ name: 'Rex', dailyMode: 'purchase' }) });
    assert.equal(purchase.body.pet.dailyGrams, 333);
    const custom = await t.call('POST', '/api/pets', { token, body: validPet({ name: 'Bob', dailyMode: 'custom', customDailyGrams: 250 }) });
    assert.equal(custom.body.pet.dailyGrams, 250);
    const noGrams = await t.call('POST', '/api/pets', { token, body: validPet({ dailyMode: 'custom' }) });
    assert.equal(noGrams.status, 400);
  });

  test('valida raça x espécie, "outra raça" exige peso, e gato SRD funciona', async () => {
    assert.equal((await t.call('POST', '/api/pets', { token, body: validPet({ species: 'cat' }) })).status, 400);
    assert.equal((await t.call('POST', '/api/pets', { token, body: validPet({ breedId: 'outra-cao' }) })).status, 400);
    const other = await t.call('POST', '/api/pets', { token, body: validPet({ breedId: 'outra-cao', breedName: 'Spitz Alemão', adultKg: 12 }) });
    assert.equal(other.status, 201);
    assert.equal(other.body.pet.breedName, 'Spitz Alemão');
    const cat = await t.call('POST', '/api/pets', { token, body: validPet({ species: 'cat', breedId: 'gato-srd', name: 'Mia', weightKg: 4, monthlyPurchaseKg: 2 }) });
    assert.equal(cat.status, 201);
    assert.equal(cat.body.pet.dailyGrams, 60);
  });

  test('um tutor não enxerga o pet de outro', async () => {
    const other = (await t.call('POST', '/api/customers', { body: validCustomer({ email: 'jose@example.com', whatsapp: '21988887777' }) })).body.token;
    const id = (await t.call('GET', '/api/me', { token })).body.pets[0].id;
    assert.equal((await t.call('GET', `/api/pets/${id}`, { token: other })).status, 404);
    assert.equal((await t.call('DELETE', `/api/pets/${id}`, { token: other })).status, 404);
  });

  test('editar sem mexer na idade mantém a data de nascimento; trocar o modo preserva o estoque', async () => {
    const created = (await t.call('POST', '/api/pets', { token, body: validPet({ name: 'Edit' }) })).body.pet;
    t.clock.advanceDays(10);
    const before = (await t.call('GET', `/api/pets/${created.id}`, { token })).body.pet;
    const edited = await t.call('PATCH', `/api/pets/${created.id}`, { token, body: { ...validPet({ name: 'Edit', dailyMode: 'custom', customDailyGrams: 200 }), ageYears: before.ageMonths / 12 | 0, ageMonths: before.ageMonths % 12 } });
    assert.equal(edited.status, 200);
    assert.equal(edited.body.pet.stock.kg, before.stock.kg);
    assert.equal(edited.body.pet.dailyGrams, 200);
  });
});

describe('aviso de ração acabando', () => {
  let t, token, petId, customerId;
  const storeKey = 'segredo';

  before(async () => {
    t = await startTestApp();
    const res = await t.call('POST', '/api/customers', { body: validCustomer() });
    token = res.body.token;
    customerId = res.body.customer.id;
    // 3 kg em casa, 300 g/dia -> 10 dias; avisa quando restarem 7 dias.
    petId = (await t.call('POST', '/api/pets', { token, body: validPet({ monthlyPurchaseKg: 9, stockKg: 3, dailyMode: 'custom', customDailyGrams: 300, alertDays: 7 }) })).body.pet.id;
  });
  after(() => t.close());

  test('antes do limite, ninguém é avisado', async () => {
    t.clock.advanceDays(2);
    await t.alerts.runCheck();
    assert.equal(t.sentWhatsApp.length, 0);
    assert.equal((await t.call('GET', '/api/store/leads', { storeKey })).body.leads.length, 0);
  });

  test('ao atingir o limite: aviso no app, WhatsApp da loja, e-mail e pedido no painel — uma única vez', async () => {
    t.clock.advanceDays(1.5); // 3,5 dias depois: restam 6,5 dias (limite: 7)
    await t.alerts.runCheck();
    await t.alerts.runCheck(); // rodar de novo não duplica

    assert.equal(t.sentWhatsApp.length, 1);
    const msg = t.sentWhatsApp[0];
    assert.equal(msg.to, '5511988887777');
    assert.match(msg.text, /Maria Silva/);
    assert.match(msg.text, /Thor/);
    assert.match(msg.text, /wa\.me\/5511999998888/);
    assert.equal(t.sentEmails.length, 1);
    assert.equal(t.sentEmails[0].to, 'maria@example.com');

    const alerts = (await t.call('GET', '/api/alerts', { token })).body.alerts;
    assert.equal(alerts.length, 1);
    assert.match(alerts[0].title, /Thor.*acabando/);
    assert.equal((await t.call('GET', '/api/me', { token })).body.unreadAlerts, 1);

    const leads = (await t.call('GET', '/api/store/leads', { storeKey })).body;
    assert.equal(leads.counts.open, 1);
    assert.equal(leads.leads[0].kind, 'low');
    assert.equal(leads.leads[0].customer.whatsapp, '(11) 99999-8888');
    assert.equal(leads.leads[0].delivery.status, 'sent');
    assert.match(decodeURIComponent(leads.leads[0].whatsappLink), /Olá, Maria!.*Thor/);
  });

  test('quando a ração acaba, o pedido vira urgente e há um segundo aviso', async () => {
    t.clock.advanceDays(7); // 10,5 dias depois: os 10 dias de ração acabaram
    await t.alerts.runCheck();
    assert.equal(t.sentWhatsApp.length, 2);
    assert.match(t.sentWhatsApp[1].text, /ACABOU/);
    const leads = (await t.call('GET', '/api/store/leads', { storeKey })).body;
    assert.equal(leads.leads.length, 1, 'continua um único pedido');
    assert.equal(leads.leads[0].kind, 'empty');
  });

  test('a loja marca o atendimento e anota', async () => {
    const [lead] = (await t.call('GET', '/api/store/leads', { storeKey })).body.leads;
    const res = await t.call('PATCH', `/api/store/leads/${lead.id}`, { storeKey, body: { status: 'contacted', note: 'Ligou às 14h' } });
    assert.equal(res.body.lead.status, 'contacted');
    assert.equal(res.body.lead.note, 'Ligou às 14h');
    assert.equal((await t.call('GET', '/api/store/leads', { storeKey })).body.counts.open, 1);
  });

  test('"Comprei ração" repõe o estoque, encerra o pedido e reinicia o ciclo', async () => {
    const res = await t.call('POST', `/api/pets/${petId}/restock`, { token, body: { kg: 9 } });
    assert.equal(res.body.pet.stock.kg, 9);
    assert.equal(res.body.pet.stock.level, 'ok');
    const leads = (await t.call('GET', '/api/store/leads?status=closed', { storeKey })).body;
    assert.equal(leads.leads.length, 1);
    assert.match(leads.leads[0].note, /Ligou às 14h.*Estoque reposto/);

    // 9 kg / 300 g = 30 dias: depois de 24 dias restam 6 -> novo ciclo, novo aviso
    t.clock.advanceDays(24);
    await t.alerts.runCheck();
    assert.equal(t.sentWhatsApp.length, 3);
    assert.equal((await t.call('GET', '/api/store/leads', { storeKey })).body.counts.open, 1);
  });

  test('"Ajustar estoque" para cima também encerra o aviso', async () => {
    const res = await t.call('POST', `/api/pets/${petId}/stock`, { token, body: { kg: 12 } });
    assert.equal(res.body.pet.stock.level, 'ok');
    assert.equal((await t.call('GET', '/api/store/leads', { storeKey })).body.counts.open, 0);
  });

  test('marcar tudo como lido', async () => {
    await t.call('POST', '/api/alerts/read', { token });
    assert.equal((await t.call('GET', '/api/me', { token })).body.unreadAlerts, 0);
  });

  test('apagar o cadastro remove pets, avisos e pedidos (LGPD)', async () => {
    assert.equal((await t.call('DELETE', '/api/me', { token })).status, 204);
    assert.equal(t.db.prepare('SELECT COUNT(*) n FROM pets WHERE customer_id = ?').get(customerId).n, 0);
    assert.equal(t.db.prepare('SELECT COUNT(*) n FROM leads').get().n, 0);
    assert.equal(t.db.prepare('SELECT COUNT(*) n FROM outbox WHERE customer_id = ?').get(customerId).n, 0);
  });
});

describe('falhas no WhatsApp da loja', () => {
  let t, token;
  before(async () => {
    t = await startTestApp();
    token = (await t.call('POST', '/api/customers', { body: validCustomer() })).body.token;
  });
  after(() => t.close());

  test('tenta de novo depois e acaba entregando', async () => {
    t.whatsapp.failNext = 1;
    await t.call('POST', '/api/pets', { token, body: validPet({ stockKg: 1, dailyMode: 'custom', customDailyGrams: 300 }) }); // já nasce "acabando"
    assert.equal(t.sentWhatsApp.length, 0);
    const leadsBefore = (await t.call('GET', '/api/store/leads', { storeKey: 'segredo' })).body.leads[0];
    assert.equal(leadsBefore.delivery.status, 'pending');
    assert.match(leadsBefore.delivery.error, /fora do ar/);

    await t.alerts.runCheck();
    assert.equal(t.sentWhatsApp.length, 0, 'ainda dentro do intervalo de espera');
    t.clock.advanceDays(1 / 24); // 1h depois
    await t.alerts.runCheck();
    assert.equal(t.sentWhatsApp.length, 1);
  });

  test('sem STORE_WHATSAPP o pedido continua aparecendo no painel', async () => {
    const t2 = await startTestApp({ STORE_WHATSAPP: '' });
    try {
      const tk = (await t2.call('POST', '/api/customers', { body: validCustomer() })).body.token;
      await t2.call('POST', '/api/pets', { token: tk, body: validPet({ stockKg: 1, dailyMode: 'custom', customDailyGrams: 300 }) });
      const { leads } = (await t2.call('GET', '/api/store/leads', { storeKey: 'segredo' })).body;
      assert.equal(leads.length, 1);
      assert.equal(leads[0].delivery.status, 'skipped');
    } finally {
      await t2.close();
    }
  });
});

describe('painel da loja', () => {
  let t;
  before(async () => { t = await startTestApp(); });
  after(() => t.close());

  test('exige a senha da loja', async () => {
    assert.equal((await t.call('GET', '/api/store/leads')).status, 401);
    assert.equal((await t.call('GET', '/api/store/leads', { storeKey: 'errada' })).status, 401);
    assert.equal((await t.call('GET', '/api/store/leads', { storeKey: 'segredo' })).status, 200);
  });

  test('mensagem de teste usa o provedor configurado', async () => {
    const res = await t.call('POST', '/api/store/test-whatsapp', { storeKey: 'segredo' });
    assert.equal(res.status, 200);
    assert.equal(t.sentWhatsApp.at(-1).to, '5511988887777');
  });

  test('em produção exige senha configurada', async () => {
    const { loadConfig } = await import('../server/config.js');
    assert.throws(() => loadConfig({ NODE_ENV: 'production' }), /STORE_ADMIN_PASSWORD/);
  });
});
