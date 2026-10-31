import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seededApp, importAndConfirm, TRIP_SHEETS, DAY } from './helpers.js';
import { ruleApplies } from '../server/services/checklist.js';

test('início: contador, progresso, próxima tarefa, voo e hospedagem', async () => {
  const { t } = await seededApp();
  try {
    const ana = await t.login('ana@example.com');
    const h = (await t.call('GET', '/api/trips/VG-001', { token: ana })).body;
    assert.equal(h.trip.destination.name, 'Itália');
    assert.equal(h.countdown.phase, 'before');
    assert.equal(h.countdown.days_to_start, 80);
    assert.equal(h.countdown.total_days, 16);
    assert.equal(h.next_flight.flight_number, 'AZ 675');
    assert.equal(h.accommodation.name, 'Hotel Exemplo Roma');
    assert.match(h.accommodation.maps_url, /google\.com\/maps\/search/);
    assert.equal(h.progress.done, 0);
    assert.equal(h.next_task.title, 'Confira nomes e dados das reservas');

    // Marca e desmarca: progresso é por viajante.
    await t.call('POST', `/api/trips/VG-001/tasks/${h.next_task.id}/complete`, { token: ana });
    const h2 = (await t.call('GET', '/api/trips/VG-001', { token: ana })).body;
    assert.equal(h2.progress.done, 1);
    assert.notEqual(h2.next_task.id, h.next_task.id);
    const bia = await t.login('bia@example.com');
    assert.equal((await t.call('GET', '/api/trips/VG-001', { token: bia })).body.progress.done, 0);
    await t.call('DELETE', `/api/trips/VG-001/tasks/${h.next_task.id}/complete`, { token: ana });
    assert.equal((await t.call('GET', '/api/trips/VG-001', { token: ana })).body.progress.done, 0);

    // Durante a viagem, no fuso do destino.
    t.clock.t = Date.UTC(2026, 11, 22, 10);
    // A sessão de 30 dias expirou nesse meio-tempo: entra de novo.
    assert.equal((await t.call('GET', '/api/me', { token: ana })).status, 401);
    const ana2 = await t.login('ana@example.com');
    const h3 = (await t.call('GET', '/api/trips/VG-001', { token: ana2 })).body;
    assert.equal(h3.countdown.phase, 'during');
    assert.equal(h3.countdown.day_number, 3);
  } finally {
    await t.close();
  }
});

test('roteiro por dia junta voos, check-in/out e atividades, com todos os dias da viagem', async () => {
  const { t } = await seededApp();
  try {
    const ana = await t.login('ana@example.com');
    const it = (await t.call('GET', '/api/trips/VG-001/itinerary', { token: ana })).body;
    assert.equal(it.days.length, 16);
    const d1 = it.days.find((d) => d.date === '2026-12-20');
    assert.equal(d1.items[0].type, 'flight');
    const d3 = it.days.find((d) => d.date === '2026-12-22');
    assert.equal(d3.items[0].title, 'Visita guiada ao Coliseu');
    assert.equal(d3.items[0].booking_status_label, 'Confirmado');
    assert.match(d3.items[0].maps_url, /Piazza%20del%20Colosseo/);
    const last = it.days.at(-1);
    assert.deepEqual(last.items.map((i) => i.type), ['checkout', 'flight']);
  } finally {
    await t.close();
  }
});

test('regras da jornada: internacional, crianças e edição de regra recalculam as tarefas', async () => {
  const { t, admin } = await seededApp();
  try {
    const titles = (id) => t.db.prepare("SELECT title FROM tasks WHERE trip_id = ? AND active = 1 AND source = 'rule'").all(id).map((x) => x.title);
    assert.ok(titles('VG-001').includes('Verifique o passaporte e os requisitos de entrada'));
    assert.ok(titles('VG-001').includes('Autorização de viagem para menores'));
    const due = t.db.prepare("SELECT due_date FROM tasks WHERE trip_id = 'VG-001' AND title LIKE 'Confira check-in%'").get().due_date;
    assert.equal(due, '2026-12-18');

    // Viagem nacional, só adultos: sem passaporte nem autorização de menor.
    await importAndConfirm(t, admin, {
      kind: 'trip',
      sheets: {
        TRIPS: [TRIP_SHEETS().TRIPS[0], ['VG-RIO', 'Rio', 'rio', '2026-11-10', '2026-11-14', '', 'published']],
        TRAVELERS: [TRIP_SHEETS().TRAVELERS[0], ['VG-RIO', 'ana@example.com', 'Ana Souza', 'titular']],
      },
    });
    assert.ok(!titles('VG-RIO').includes('Verifique o passaporte e os requisitos de entrada'));
    assert.ok(!titles('VG-RIO').includes('Autorização de viagem para menores'));

    // Remover a criança da viagem desativa a tarefa (sem apagar).
    const bia = t.db.prepare("SELECT tt.id FROM trip_travelers tt JOIN users u ON u.id = tt.user_id WHERE u.email = 'bia@example.com'").get();
    await t.call('DELETE', `/api/admin/trips/VG-001/travelers/${bia.id}`, { token: admin });
    assert.ok(!titles('VG-001').includes('Autorização de viagem para menores'));

    // Editar o prazo da regra atualiza a tarefa de todas as viagens.
    const rule = t.db.prepare("SELECT id FROM checklist_rules WHERE title LIKE 'Monte a mala%'").get();
    const r = await t.call('PATCH', `/api/admin/rules/${rule.id}`, { token: admin, body: { days_before: 10 } });
    assert.equal(r.status, 200);
    assert.equal(t.db.prepare("SELECT due_date FROM tasks WHERE trip_id = 'VG-001' AND rule_id = ?").get(rule.id).due_date, '2026-12-10');

    // Regra nova só para família.
    const nr = await t.call('POST', '/api/admin/rules', { token: admin, body: { title: 'Kit para crianças', days_before: 20, conditions: { trip_types: ['familia'] } } });
    assert.equal(nr.status, 201);
    assert.ok(titles('VG-001').includes('Kit para crianças'));
    assert.ok(!titles('VG-RIO').includes('Kit para crianças'));
    assert.equal((await t.call('POST', '/api/admin/rules', { token: admin, body: { title: 'X', conditions: { signo: ['leão'] } } })).status, 422);

    // Tarefa de regra não é editada pela rota de tarefas.
    const ruleTask = t.db.prepare("SELECT id FROM tasks WHERE trip_id = 'VG-001' AND source = 'rule' LIMIT 1").get();
    assert.equal((await t.call('PATCH', `/api/admin/trips/VG-001/tasks/${ruleTask.id}`, { token: admin, body: { title: 'x' } })).status, 409);
  } finally {
    await t.close();
  }
});

test('ruleApplies: nacionalidade, duração e país', () => {
  const trip = { start_date: '2026-12-20', end_date: '2026-12-24', trip_type: 'lazer' };
  const base = { trip, country: 'Itália', travelers: [{ traveler_role: 'titular', nationality: 'Brasil' }], homeCountry: 'Brasil' };
  assert.equal(ruleApplies({ conditions: { nationalities: ['brasil'] } }, base), true);
  assert.equal(ruleApplies({ conditions: { nationalities: ['Portugal'] } }, base), false);
  assert.equal(ruleApplies({ conditions: { min_days: 6 } }, base), false);
  assert.equal(ruleApplies({ conditions: { max_days: 5 } }, base), true);
  assert.equal(ruleApplies({ conditions: { countries: ['italia'] } }, base), true);
  assert.equal(ruleApplies({ conditions: { exclude_countries: ['Itália'] } }, base), false);
});

test('lembretes: um por tarefa, só para quem não concluiu, respeitando o fuso', async () => {
  const { t } = await seededApp();
  try {
    const n = t.services.notifications;
    // 2 dias antes do prazo da tarefa "Escolher horário do Vaticano" (30/11).
    t.clock.t = Date.UTC(2026, 10, 28, 12);
    const ana = await t.login('ana@example.com');
    const task = t.db.prepare("SELECT id FROM tasks WHERE title = 'Escolher horário do Vaticano'").get();
    await t.call('POST', `/api/trips/VG-001/tasks/${task.id}/complete`, { token: ana });
    n.runTaskReminders(3);
    n.runTaskReminders(3);
    const rows = t.db.prepare("SELECT u.email FROM notifications x JOIN users u ON u.id = x.user_id WHERE x.kind = 'task_reminder' AND x.dedupe_key LIKE ?").all(`task:${task.id}:%`);
    assert.deepEqual(rows.map((r) => r.email), ['bia@example.com']);
    const sent = t.emails.length;
    await n.dispatchEmails();
    assert.ok(t.emails.length > sent);
    assert.ok(t.emails.slice(sent).some((m) => m.to === 'bia@example.com' && /Escolher horário do Vaticano/.test(m.subject)));
  } finally {
    await t.close();
  }
});

test('guia: só lugares aprovados do destino da viagem, filtros, destaques, perto do hotel e favoritos', async () => {
  const { t, admin } = await seededApp();
  try {
    const ana = await t.login('ana@example.com');
    assert.equal((await t.call('GET', '/api/trips/VG-001/guide', { token: ana })).body.places.length, 0, 'pendentes não aparecem');
    await t.call('POST', '/api/admin/places/review', { token: admin, body: { ids: ['roma-coliseu', 'roma-cafe'], action: 'approve' } });
    let g = (await t.call('GET', '/api/trips/VG-001/guide', { token: ana })).body;
    assert.deepEqual(g.places.map((p) => p.id).sort(), ['roma-cafe', 'roma-coliseu']);
    assert.ok(g.destinations.some((d) => d.name === 'Roma'));
    assert.match(g.places.find((p) => p.id === 'roma-coliseu').cover.url, /^\/api\/media\//);
    const img = await t.call('GET', g.places.find((p) => p.id === 'roma-coliseu').cover.url, { token: ana, raw: true });
    assert.equal(img.headers.get('content-type'), 'image/png');

    g = (await t.call('GET', '/api/trips/VG-001/guide?category=cafe', { token: ana })).body;
    assert.deepEqual(g.places.map((p) => p.id), ['roma-cafe']);
    g = (await t.call('GET', '/api/trips/VG-001/guide?q=colis', { token: ana })).body;
    assert.deepEqual(g.places.map((p) => p.id), ['roma-coliseu']);

    g = (await t.call('GET', '/api/trips/VG-001/guide?near=hotel', { token: ana })).body;
    assert.equal(g.near_hotel.name, 'Hotel Exemplo Roma');
    assert.ok(g.places.every((p) => typeof p.distance_km === 'number'));
    assert.ok(g.places[0].distance_km <= g.places[1].distance_km);

    await t.call('PUT', '/api/admin/trips/VG-001/highlights/roma-cafe', { token: admin, body: { note: 'O preferido da Vagari' } });
    g = (await t.call('GET', '/api/trips/VG-001/guide', { token: ana })).body;
    assert.equal(g.places[0].id, 'roma-cafe');
    assert.equal(g.places[0].highlight_note, 'O preferido da Vagari');

    await t.call('POST', '/api/places/roma-coliseu/favorite', { token: ana });
    await t.call('POST', '/api/places/roma-coliseu/favorite', { token: ana });
    g = (await t.call('GET', '/api/trips/VG-001/guide?favorites=1', { token: ana })).body;
    assert.deepEqual(g.places.map((p) => p.id), ['roma-coliseu']);
    assert.equal((await t.call('GET', '/api/favorites', { token: ana })).body.places.length, 1);

    // Arquivar tira do guia (e dos favoritos visíveis).
    await t.call('POST', '/api/admin/places/review', { token: admin, body: { ids: ['roma-coliseu'], action: 'archive' } });
    assert.equal((await t.call('GET', '/api/favorites', { token: ana })).body.places.length, 0);
    assert.equal((await t.call('GET', '/api/places/roma-coliseu', { token: ana })).status, 404);
  } finally {
    await t.close();
  }
});

test('ajuda: WhatsApp vem do painel, com mensagem contextual; 24h só se configurado', async () => {
  const { t, admin } = await seededApp();
  try {
    const ana = await t.login('ana@example.com');
    let help = (await t.call('GET', '/api/trips/VG-001/help', { token: ana })).body;
    assert.equal(help.whatsapp_url, null, 'sem número configurado, sem botão');
    assert.equal(help.support_24h, false);
    assert.doesNotMatch(help.support_hours_text, /24/);

    assert.equal((await t.call('PATCH', '/api/admin/settings', { token: admin, body: { whatsapp_number: '(11) 9999' } })).status, 422);
    await t.call('PATCH', '/api/admin/settings', { token: admin, body: { whatsapp_number: '5511999990000', support_24h: true } });
    help = (await t.call('GET', '/api/trips/VG-001/help', { token: ana })).body;
    const url = new URL(help.whatsapp_url);
    assert.equal(url.host + url.pathname, 'wa.me/5511999990000');
    const text = url.searchParams.get('text');
    assert.match(text, /Ana Souza/);
    assert.match(text, /VG-001/);
    assert.match(text, /Itália/);
    assert.equal(help.support_hours_text, 'Atendimento 24 horas');
    assert.ok(t.db.prepare("SELECT 1 FROM audit_log WHERE entity_type = 'settings'").get());
  } finally {
    await t.close();
  }
});

test('avisos para um grupo de viagens e notificação de mudança importante', async () => {
  const { t, admin } = await seededApp();
  try {
    const ana = await t.login('ana@example.com');
    const r = await t.call('POST', '/api/admin/announcements', { token: admin, body: { trip_ids: ['VG-001'], title: 'Greve no aeroporto', body: 'Chegue 4h antes.', essential: true } });
    assert.equal(r.status, 201);
    const home = (await t.call('GET', '/api/trips/VG-001', { token: ana })).body;
    assert.equal(home.announcements[0].title, 'Greve no aeroporto');
    // Essencial vai por e-mail mesmo com preferência desligada.
    await t.call('PATCH', '/api/me', { token: ana, body: { notification_prefs: { email_updates: false } } });
    await t.call('POST', '/api/admin/announcements', { token: admin, body: { trip_ids: ['VG-001'], title: 'Outro essencial', body: 'x', essential: true } });
    await t.call('POST', '/api/admin/announcements', { token: admin, body: { trip_ids: ['VG-001'], title: 'Dica opcional', body: 'x' } });
    const before = t.emails.length;
    await t.services.notifications.dispatchEmails();
    const toAna = t.emails.slice(before).filter((m) => m.to === 'ana@example.com').map((m) => m.subject);
    assert.ok(toAna.some((s) => /Outro essencial/.test(s)));
    assert.ok(!toAna.some((s) => /Dica opcional/.test(s)));

    // Mudança de roteiro pelo painel: só avisa se a equipe marcar.
    const item = t.db.prepare('SELECT id FROM itinerary_items LIMIT 1').get();
    await t.call('PATCH', `/api/admin/trips/VG-001/itinerary/${item.id}`, { token: admin, body: { start_time: '10:00' } });
    let notes = (await t.call('GET', '/api/notifications', { token: ana })).body;
    assert.ok(!notes.notifications.some((n) => n.kind === 'trip_update'));
    await t.call('PATCH', `/api/admin/trips/VG-001/itinerary/${item.id}`, { token: admin, body: { start_time: '10:30', _notify: true } });
    notes = (await t.call('GET', '/api/notifications', { token: ana })).body;
    assert.ok(notes.notifications.some((n) => n.kind === 'trip_update'));
    assert.ok(notes.unread > 0);
    await t.call('POST', '/api/notifications/read', { token: ana, body: {} });
    assert.equal((await t.call('GET', '/api/notifications', { token: ana })).body.unread, 0);
  } finally {
    await t.close();
  }
});

test('painel: CRUD de voo usa as mesmas validações e permite renumerar sem duplicar', async () => {
  const { t, admin } = await seededApp();
  try {
    const bad = await t.call('POST', '/api/admin/trips/VG-001/flights', { token: admin, body: { segment_order: 3, airline: 'X', flight_number: 'X1', departure_airport: 'GRUU', departure_datetime: 'ontem', arrival_airport: 'FCO', arrival_datetime: '2026-12-21 10:00' } });
    assert.equal(bad.status, 422);
    assert.deepEqual(bad.body.issues.map((i) => i.column).sort(), ['departure_airport', 'departure_datetime']);
    const ok = await t.call('POST', '/api/admin/trips/VG-001/flights', { token: admin, body: { segment_order: 3, airline: 'X', flight_number: 'X1', departure_airport: 'fco', departure_datetime: '2026-12-26 10:00', arrival_airport: 'CDG', arrival_datetime: '2026-12-26 12:00' } });
    assert.equal(ok.status, 201);
    assert.equal(ok.body.item.departure_airport, 'FCO');
    const clash = await t.call('PATCH', `/api/admin/trips/VG-001/flights/${ok.body.item.id}`, { token: admin, body: { segment_order: 1 } });
    assert.equal(clash.status, 422);
    const ren = await t.call('PATCH', `/api/admin/trips/VG-001/flights/${ok.body.item.id}`, { token: admin, body: { segment_order: 5 } });
    assert.equal(ren.status, 200);
    assert.equal(t.db.prepare("SELECT COUNT(*) n FROM flight_segments WHERE trip_id = 'VG-001'").get().n, 3);
    const del = await t.call('DELETE', `/api/admin/trips/VG-001/flights/${ok.body.item.id}`, { token: admin });
    assert.equal(del.status, 200);
    const hist = await t.call('GET', `/api/admin/audit?entity_id=${ok.body.item.id}`, { token: admin });
    assert.deepEqual(hist.body.entries.map((e) => e.action), ['delete', 'update', 'create']);
    assert.equal(hist.body.entries[0].actor_email, 'admin@vagari.test');
  } finally {
    await t.close();
  }
});

test('conteúdo: aprovar exige endereço ou coordenadas; prompt de pesquisa sai com as colunas do modelo', async () => {
  const { t, admin } = await seededApp();
  try {
    await t.call('POST', '/api/admin/places', { token: admin, body: { content_id: 'roma-sem-endereco', destination_id: 'roma', name: 'Sem endereço', category: 'bar' } });
    const r = await t.call('POST', '/api/admin/places/review', { token: admin, body: { ids: ['roma-sem-endereco'], action: 'approve' } });
    assert.equal(r.body.blocked.length, 1);
    const p = await t.call('GET', '/api/admin/content/research-prompt?city=Roma&country=Itália&destination_id=roma', { token: admin });
    assert.match(p.body.prompt, /Pesquise a cidade Roma, no país Itália/);
    assert.match(p.body.prompt, /content_id \| destination_id \| name \| category/);
    assert.match(p.body.prompt, /PENDENTE DE REVISÃO HUMANA/);
  } finally {
    await t.close();
  }
});

test('métricas e LGPD', async () => {
  const { t, admin } = await seededApp();
  try {
    const ana = await t.login('ana@example.com');
    await t.call('POST', '/api/events', { token: ana, body: { name: 'whatsapp_click', trip_id: 'VG-001' } });
    assert.equal((await t.call('POST', '/api/events', { token: ana, body: { name: 'qualquer' } })).status, 422);
    const m = (await t.call('GET', '/api/admin/metrics', { token: admin })).body;
    assert.equal(m.whatsapp_clicks, 1);
    assert.equal(m.trips_essential_complete.complete, 1);
    assert.equal(m.imports.completed, 2);

    const exp = await t.call('GET', '/api/me/export', { token: ana });
    assert.equal(exp.status, 200);
    assert.equal(exp.body.user.email, 'ana@example.com');
    const req = await t.call('POST', '/api/me/privacy-requests', { token: ana, body: { kind: 'deletion', message: 'Apaguem meus dados após a viagem.' } });
    assert.equal(req.status, 201);
    assert.equal((await t.call('GET', '/api/admin/privacy-requests', { token: admin })).body.requests.length, 1);
  } finally {
    await t.close();
  }
});
