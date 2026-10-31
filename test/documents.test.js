import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seededApp, importAndConfirm, TRIP_SHEETS, PDF } from './helpers.js';

const docByTitle = (t, title) => t.db.prepare('SELECT * FROM documents WHERE title = ?').get(title);

test('documento interno não aparece nem pode ser baixado pelo viajante', async () => {
  const { t } = await seededApp();
  try {
    const ana = await t.login('ana@example.com');
    const list = await t.call('GET', '/api/trips/VG-001/documents', { token: ana });
    assert.deepEqual(list.body.documents.map((d) => d.title), ['Voucher do hotel']);
    assert.equal(list.body.groups[0].label, 'Voucher');
    const internal = docByTitle(t, 'Contrato com fornecedor');
    assert.equal((await t.call('GET', `/api/trips/VG-001/documents/${internal.id}/file`, { token: ana })).status, 404);
    const voucher = docByTitle(t, 'Voucher do hotel');
    const file = await t.call('GET', `/api/trips/VG-001/documents/${voucher.id}/file`, { token: ana, raw: true });
    assert.equal(file.status, 200);
    assert.equal(file.headers.get('content-type'), 'application/pdf');
    assert.match(Buffer.from(await file.arrayBuffer()).toString(), /voucher/);
  } finally {
    await t.close();
  }
});

test('viajante de outra viagem não acessa o documento nem trocando o código da viagem na URL', async () => {
  const { t, admin } = await seededApp();
  try {
    await importAndConfirm(t, admin, { kind: 'trip', sheets: { TRIPS: TRIP_SHEETS('VG-002').TRIPS, TRAVELERS: TRIP_SHEETS('VG-002', 'carlos@example.com').TRAVELERS.slice(0, 2) } });
    const carlos = await t.login('carlos@example.com');
    const voucher = docByTitle(t, 'Voucher do hotel');
    assert.equal((await t.call('GET', `/api/trips/VG-001/documents/${voucher.id}/file`, { token: carlos })).status, 404);
    assert.equal((await t.call('GET', `/api/trips/VG-002/documents/${voucher.id}/file`, { token: carlos })).status, 404);
  } finally {
    await t.close();
  }
});

test('tornar visível e substituir arquivo: nova versão, histórico e aviso ao viajante', async () => {
  const { t, admin } = await seededApp();
  try {
    const ana = await t.login('ana@example.com');
    const internal = docByTitle(t, 'Contrato com fornecedor');
    const r = await t.call('PATCH', `/api/admin/trips/VG-001/documents/${internal.id}`, { token: admin, body: { visible_to_traveler: true, category: 'reserva' } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.document.storage_key, undefined, 'chave interna do arquivo não sai na API');
    let notes = (await t.call('GET', '/api/notifications', { token: ana })).body.notifications;
    assert.ok(notes.some((n) => n.title === 'Novo documento: Contrato com fornecedor'));

    const voucher = docByTitle(t, 'Voucher do hotel');
    const form = new FormData();
    form.append('file', new Blob([PDF('voucher v2')]), 'voucher-hotel-v2.pdf');
    const rep = await t.call('POST', `/api/admin/trips/VG-001/documents/${voucher.id}/file`, { token: admin, form });
    assert.equal(rep.status, 200, JSON.stringify(rep.body));
    assert.equal(rep.body.document.version, 2);
    const versions = await t.call('GET', `/api/admin/trips/VG-001/documents/${voucher.id}/versions`, { token: admin });
    assert.deepEqual(versions.body.versions.map((v) => v.version), [2, 1]);
    const file = await t.call('GET', `/api/trips/VG-001/documents/${voucher.id}/file`, { token: ana, raw: true });
    assert.match(Buffer.from(await file.arrayBuffer()).toString(), /voucher v2/);
    notes = (await t.call('GET', '/api/notifications', { token: ana })).body.notifications;
    assert.ok(notes.some((n) => n.title === 'Documento atualizado: Voucher do hotel'));
    // A versão anterior continua disponível para a equipe.
    const old = await t.call('GET', `/api/admin/trips/VG-001/documents/${voucher.id}/file?version=1`, { token: admin, raw: true });
    assert.match(Buffer.from(await old.arrayBuffer()).toString(), /% voucher\n/);
    assert.ok(t.db.prepare("SELECT 1 FROM audit_log WHERE entity_id = ? AND action = 'replace_file'").get(voucher.id));

    // Reenviar o mesmo arquivo não cria versão nova.
    const same = new FormData();
    same.append('file', new Blob([PDF('voucher v2')]), 'voucher-hotel-v2.pdf');
    const r2 = await t.call('POST', `/api/admin/trips/VG-001/documents/${voucher.id}/file`, { token: admin, form: same });
    assert.equal(r2.body.document.version, 2);
  } finally {
    await t.close();
  }
});

test('link assinado: funciona por 5 minutos, não aceita adulteração e revalida o acesso', async () => {
  const { t, admin } = await seededApp();
  try {
    const ana = await t.login('ana@example.com');
    const voucher = docByTitle(t, 'Voucher do hotel');
    const link = await t.call('POST', `/api/trips/VG-001/documents/${voucher.id}/link`, { token: ana });
    assert.equal(link.status, 200);
    assert.equal((await t.call('GET', link.body.url, { raw: true })).status, 200);
    assert.equal((await t.call('GET', link.body.url.replace(/s=[^&]+/, 's=abc'), { raw: true })).status, 403);
    const internal = docByTitle(t, 'Contrato com fornecedor');
    assert.equal((await t.call('GET', link.body.url.replace(voucher.id, internal.id), { raw: true })).status, 403);
    // Depois de tirar a visibilidade, o link (ainda dentro do prazo) para de funcionar.
    await t.call('PATCH', `/api/admin/trips/VG-001/documents/${voucher.id}`, { token: admin, body: { visible_to_traveler: false } });
    assert.equal((await t.call('GET', link.body.url, { raw: true })).status, 404);
    await t.call('PATCH', `/api/admin/trips/VG-001/documents/${voucher.id}`, { token: admin, body: { visible_to_traveler: true } });
    t.clock.t += 6 * 60_000;
    assert.equal((await t.call('GET', link.body.url, { raw: true })).status, 410);
  } finally {
    await t.close();
  }
});

test('upload pelo painel e exclusão explícita', async () => {
  const { t, admin } = await seededApp();
  try {
    const form = new FormData();
    form.append('category', 'seguro');
    form.append('visible_to_traveler', 'sim');
    form.append('stage', 'antes');
    form.append('file', new Blob([PDF('apolice')]), 'Apólice seguro.pdf');
    const r = await t.call('POST', '/api/admin/trips/VG-001/documents', { token: admin, form });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.document.title, 'Apólice seguro');
    const del = await t.call('DELETE', `/api/admin/trips/VG-001/documents/${r.body.document.id}`, { token: admin });
    assert.equal(del.status, 200);
    assert.equal(t.db.prepare('SELECT COUNT(*) n FROM documents WHERE id = ?').get(r.body.document.id).n, 0);
  } finally {
    await t.close();
  }
});
