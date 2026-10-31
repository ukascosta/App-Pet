import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seededApp, importForm, xlsx, CONTENT_SHEETS, TRIP_SHEETS, importAndConfirm, PDF } from './helpers.js';

test('sem login: nada do painel nem do viajante', async () => {
  const { t } = await seededApp();
  try {
    for (const url of ['/api/admin/trips', '/api/admin/places', '/api/admin/settings', '/api/me', '/api/trips/VG-001', '/api/admin/imports']) {
      assert.equal((await t.call('GET', url)).status, 401, url);
    }
  } finally {
    await t.close();
  }
});

test('viajante não acessa o painel', async () => {
  const { t } = await seededApp();
  try {
    const ana = await t.login('ana@example.com');
    for (const [m, url] of [
      ['GET', '/api/admin/trips'],
      ['GET', '/api/admin/trips/VG-001'],
      ['PATCH', '/api/admin/trips/VG-001'],
      ['GET', '/api/admin/places'],
      ['GET', '/api/admin/settings'],
      ['GET', '/api/admin/audit'],
      ['POST', '/api/admin/places/review'],
      ['GET', '/api/admin/templates/viagem.xlsx'],
    ]) {
      assert.equal((await t.call(m, url, { token: ana, body: m === 'GET' ? undefined : {} })).status, 403, `${m} ${url}`);
    }
    // E não edita dados da viagem por nenhuma rota do viajante.
    assert.equal((await t.call('PATCH', '/api/trips/VG-001', { token: ana, body: { name: 'x' } })).status, 404);
  } finally {
    await t.close();
  }
});

test('editor de conteúdo: biblioteca sim, viagens não', async () => {
  const { t, admin } = await seededApp();
  try {
    await t.call('POST', '/api/admin/users', { token: admin, body: { email: 'editor@vagari.test', name: 'Edi', role: 'editor' } });
    const ed = await t.login('editor@vagari.test');
    assert.equal((await t.call('GET', '/api/admin/places', { token: ed })).status, 200);
    assert.equal((await t.call('POST', '/api/admin/places/review', { token: ed, body: { ids: ['roma-coliseu'], action: 'approve' } })).status, 200);
    assert.equal((await t.call('GET', '/api/admin/trips', { token: ed })).status, 403);
    assert.equal((await t.call('GET', '/api/admin/settings', { token: ed })).status, 403);
    assert.equal((await t.call('GET', '/api/trips/VG-001', { token: ed })).status, 404);
    // Importa conteúdo, mas não viagem.
    const content = await t.call('POST', '/api/admin/imports', { token: ed, form: importForm({ kind: 'content', spreadsheets: [{ name: 'c.xlsx', buffer: await xlsx({ DESTINATIONS: CONTENT_SHEETS.DESTINATIONS }) }] }) });
    assert.equal(content.status, 201);
    const trip = await t.call('POST', '/api/admin/imports', { token: ed, form: importForm({ kind: 'trip', spreadsheets: [{ name: 'v.xlsx', buffer: await xlsx(TRIP_SHEETS('VG-ED')) }] }) });
    assert.equal(trip.status, 403);
    // Nem vê importações de viagem de outros.
    const list = await t.call('GET', '/api/admin/imports', { token: ed });
    assert.ok(list.body.imports.every((j) => j.kind === 'content'));
    const tripJob = t.db.prepare("SELECT id FROM import_jobs WHERE kind = 'trip'").get();
    assert.equal((await t.call('GET', `/api/admin/imports/${tripJob.id}`, { token: ed })).status, 403);
  } finally {
    await t.close();
  }
});

test('viajante só vê as próprias viagens publicadas', async () => {
  const { t, admin } = await seededApp();
  try {
    // Outra viagem, de outro cliente, e uma em rascunho para a Ana.
    await importAndConfirm(t, admin, { kind: 'trip', sheets: { ...TRIP_SHEETS('VG-002', 'carlos@example.com'), DOCUMENTS: [TRIP_SHEETS().DOCUMENTS[0]] } });
    await importAndConfirm(t, admin, {
      kind: 'trip',
      sheets: {
        TRIPS: [TRIP_SHEETS().TRIPS[0], ['VG-003', 'Rascunho', 'italia', '2027-05-01', '2027-05-10', '', 'draft']],
        TRAVELERS: [TRIP_SHEETS().TRAVELERS[0], ['VG-003', 'ana@example.com', 'Ana Souza', 'titular']],
      },
    });
    const ana = await t.login('ana@example.com');
    const me = await t.call('GET', '/api/me', { token: ana });
    assert.deepEqual(me.body.trips.map((x) => x.id), ['VG-001']);
    assert.equal((await t.call('GET', '/api/trips/VG-002', { token: ana })).status, 404);
    assert.equal((await t.call('GET', '/api/trips/VG-003', { token: ana })).status, 404);
    assert.equal((await t.call('GET', '/api/trips/VG-002/documents', { token: ana })).status, 404);
    // Administrador pode pré-visualizar qualquer viagem, inclusive rascunho.
    const prev = await t.call('GET', '/api/trips/VG-003', { token: admin });
    assert.equal(prev.status, 200);
    assert.equal(prev.body.trip.preview, true);
  } finally {
    await t.close();
  }
});

test('não é possível remover o último administrador', async () => {
  const { t, admin } = await seededApp();
  try {
    const me = t.db.prepare("SELECT id FROM users WHERE email = 'admin@vagari.test'").get();
    const r = await t.call('PATCH', `/api/admin/users/${me.id}`, { token: admin, body: { role: 'editor' } });
    assert.equal(r.status, 409);
  } finally {
    await t.close();
  }
});

test('usuário desativado perde a sessão na hora', async () => {
  const { t, admin } = await seededApp();
  try {
    const ana = await t.login('ana@example.com');
    const id = t.db.prepare("SELECT id FROM users WHERE email = 'ana@example.com'").get().id;
    await t.call('PATCH', `/api/admin/users/${id}`, { token: admin, body: { disabled: true } });
    assert.equal((await t.call('GET', '/api/me', { token: ana })).status, 401);
  } finally {
    await t.close();
  }
});

test('requisição de outra origem com cookie é bloqueada', async () => {
  const { t, admin } = await seededApp();
  try {
    const r = await t.call('POST', '/api/admin/announcements', {
      token: admin,
      headers: { Origin: 'https://site-malicioso.example' },
      body: { trip_ids: ['VG-001'], title: 'x', body: 'y' },
    });
    assert.equal(r.status, 403);
  } finally {
    await t.close();
  }
});

test('upload rejeita arquivo com extensão falsa', async () => {
  const { t, admin } = await seededApp();
  try {
    const form = new FormData();
    form.append('category', 'voucher');
    form.append('visible_to_traveler', 'sim');
    form.append('file', new Blob([Buffer.from('MZ executável')]), 'voucher.pdf');
    const r = await t.call('POST', '/api/admin/trips/VG-001/documents', { token: admin, form });
    assert.equal(r.status, 422);
    assert.match(JSON.stringify(r.body.issues), /não corresponde a um arquivo .pdf/);
    form.set('file', new Blob([PDF()]), 'voucher.exe');
    assert.equal((await t.call('POST', '/api/admin/trips/VG-001/documents', { token: admin, form })).status, 422);
  } finally {
    await t.close();
  }
});
