import { test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { startTestApp, seededApp, xlsx, importForm, importAndConfirm, CONTENT_SHEETS, TRIP_SHEETS, PDF, PNG } from './helpers.js';

const preview = (t, token, opts) => t.call('POST', '/api/admin/imports', { token, form: importForm(opts) });

test('conteúdo: prévia, confirmação, tudo entra pendente de revisão e reimportar não duplica', async () => {
  const t = await startTestApp();
  try {
    const admin = await t.login('admin@vagari.test');
    const buffer = await xlsx(CONTENT_SHEETS);
    const p = await preview(t, admin, { kind: 'content', spreadsheets: [{ name: 'conteudo.xlsx', buffer }], attachments: [{ name: 'coliseu.png', buffer: PNG() }] });
    assert.equal(p.status, 201);
    const counts = Object.fromEntries(p.body.import.preview.sheets.map((s) => [s.sheet, s.counts]));
    assert.deepEqual(counts.DESTINATIONS, { create: 4, update: 0, unchanged: 0, error: 0 });
    assert.deepEqual(counts.PLACES, { create: 2, update: 0, unchanged: 0, error: 0 });
    assert.equal(p.body.import.preview.errorCount, 0);
    // Nada gravado antes de confirmar.
    assert.equal(t.db.prepare('SELECT COUNT(*) n FROM places').get().n, 0);

    const c = await t.call('POST', `/api/admin/imports/${p.body.import.id}/confirm`, { token: admin, body: {} });
    assert.equal(c.status, 200);
    assert.equal(c.body.import.status, 'completed');
    const places = t.db.prepare('SELECT id, status, category, tags FROM places ORDER BY id').all();
    assert.deepEqual(places.map((x) => x.status), ['pending_review', 'pending_review']);
    assert.equal(places.find((x) => x.id === 'roma-coliseu').category, 'ponto_turistico');
    assert.deepEqual(JSON.parse(places.find((x) => x.id === 'roma-coliseu').tags), ['história', 'ao ar livre']);
    assert.ok(t.db.prepare('SELECT storage_key FROM place_media').get().storage_key);

    // Reimportar a mesma planilha: nada muda.
    const p2 = await preview(t, admin, { kind: 'content', spreadsheets: [{ name: 'conteudo.xlsx', buffer }], attachments: [{ name: 'coliseu.png', buffer: PNG() }] });
    for (const s of p2.body.import.preview.sheets) assert.equal(s.counts.unchanged, s.rows.length, s.sheet);

    // Aprovar e depois mudar o conteúdo: volta para revisão.
    await t.call('POST', '/api/admin/places/review', { token: admin, body: { ids: ['roma-coliseu'], action: 'approve' } });
    assert.equal(t.db.prepare("SELECT status FROM places WHERE id = 'roma-coliseu'").get().status, 'approved');
    const changed = structuredClone(CONTENT_SHEETS);
    changed.PLACES[1][4] = 'Anfiteatro romano do século I.';
    delete changed.MEDIA;
    const p3 = await preview(t, admin, { kind: 'content', spreadsheets: [{ name: 'c.xlsx', buffer: await xlsx(changed) }] });
    const row = p3.body.import.preview.sheets.find((s) => s.sheet === 'PLACES').rows[0];
    assert.equal(row.action, 'update');
    assert.deepEqual(row.changes.short_description, { from: 'Anfiteatro.', to: 'Anfiteatro romano do século I.' });
    assert.ok(row.issues.some((i) => /volta para revisão/.test(i.message)));
    await t.call('POST', `/api/admin/imports/${p3.body.import.id}/confirm`, { token: admin, body: {} });
    assert.equal(t.db.prepare("SELECT status FROM places WHERE id = 'roma-coliseu'").get().status, 'pending_review');
  } finally {
    await t.close();
  }
});

test('viagem: importa todas as abas, gera tarefas e é idempotente', async () => {
  const { t, admin } = await seededApp();
  try {
    const q = (sql) => t.db.prepare(sql).get().n;
    assert.equal(q('SELECT COUNT(*) n FROM trips'), 1);
    assert.equal(q('SELECT COUNT(*) n FROM trip_travelers'), 2);
    assert.equal(q('SELECT COUNT(*) n FROM flight_segments'), 2);
    assert.equal(q('SELECT COUNT(*) n FROM documents'), 2);
    assert.equal(q("SELECT COUNT(*) n FROM tasks WHERE source = 'import'"), 1);
    assert.ok(q("SELECT COUNT(*) n FROM tasks WHERE source = 'rule' AND active = 1") >= 5);
    // Fuso herdado do destino; data DD/MM/AAAA convertida.
    const trip = t.db.prepare("SELECT * FROM trips WHERE id = 'VG-001'").get();
    assert.equal(trip.timezone, 'Europe/Rome');
    assert.equal(trip.start_date, '2026-12-20');
    assert.equal(t.db.prepare("SELECT departure_at FROM flight_segments WHERE segment_order = 1").get().departure_at, '2026-12-20T22:40');

    // Mesma planilha de novo: nada a criar ou atualizar.
    const p = await preview(t, admin, {
      kind: 'trip',
      spreadsheets: [{ name: 'v.xlsx', buffer: await xlsx(TRIP_SHEETS()) }],
      attachments: [{ name: 'voucher-hotel.pdf', buffer: PDF('voucher') }, { name: 'contrato.pdf', buffer: PDF('contrato') }],
    });
    for (const s of p.body.import.preview.sheets) assert.equal(s.counts.unchanged, s.rows.length, s.sheet);

    // Atualização parcial: só a aba de voos, com horário novo. Nada some.
    const sheets = { FLIGHTS: [TRIP_SHEETS().FLIGHTS[0], ['VG-001', '1', 'ITA Airways', 'AZ 675', 'GRU', '20/12/2026 23:10', 'FCO', '21/12/2026 15:25', 'ABC123']] };
    const p2 = await preview(t, admin, { kind: 'trip', spreadsheets: [{ name: 'v.xlsx', buffer: await xlsx(sheets) }] });
    const r = p2.body.import.preview.sheets[0].rows[0];
    assert.equal(r.action, 'update');
    assert.deepEqual(r.changes.departure_datetime, { from: '2026-12-20T22:40', to: '2026-12-20T23:10' });
    await t.call('POST', `/api/admin/imports/${p2.body.import.id}/confirm`, { token: admin, body: {} });
    assert.equal(q('SELECT COUNT(*) n FROM flight_segments'), 2);
    assert.equal(q('SELECT COUNT(*) n FROM accommodations'), 1);
    // Histórico registra antes/depois.
    const log = t.db.prepare("SELECT * FROM audit_log WHERE entity_type = 'flight_segment' AND action = 'update'").get();
    assert.match(log.before_json, /22:40/);
    assert.match(log.after_json, /23:10/);
    assert.equal(log.source, 'import');
  } finally {
    await t.close();
  }
});

test('validação: erros por linha e coluna, com instrução de correção; confirmação bloqueada', async () => {
  const { t, admin } = await seededApp();
  try {
    const sheets = {
      TRIPS: [
        ['trip_id', 'trip_name', 'destination_id', 'start_date', 'end_date', 'timezone'],
        ['VG 002', 'Sem destino', 'marte', '31/02/2026', '2026-01-01', 'Lua/Base'],
      ],
      TRAVELERS: [
        ['trip_id', 'traveler_email', 'traveler_name'],
        ['VG-001', 'ana-sem-arroba.com', 'Ana'],
        ['VG-404', 'zeca@example.com', 'Zeca'],
      ],
      FLIGHTS: [
        ['trip_id', 'segment_order', 'airline', 'flight_number', 'departure_airport', 'departure_datetime', 'arrival_airport', 'arrival_datetime'],
        ['VG-001', '3', 'X', 'X1', 'GRU', 'amanhã', 'FCO', '2026-12-21 10:00'],
        ['VG-001', '4', 'X', 'X2', 'GRU', '2026-12-21 10:00', 'FCO', '2026-12-21 20:00'],
        ['VG-001', '4', 'X', 'X2', 'GRU', '2026-12-21 10:00', 'FCO', '2026-12-21 20:00'],
      ],
      ACCOMMODATIONS: [
        ['trip_id', 'property_name', 'checkin_datetime', 'checkout_datetime'],
        ['VG-001', 'Hotel Errado', '2026-12-25', '2026-12-24'],
      ],
      DOCUMENTS: [
        ['trip_id', 'category', 'file_name', 'file_url_or_upload_name', 'visible_to_traveler'],
        ['VG-001', 'passaporte', 'Doc', 'nao-enviado.pdf', 'talvez'],
      ],
      PLANILHA_ESTRANHA: [['a'], ['b']],
    };
    const p = await preview(t, admin, { kind: 'trip', spreadsheets: [{ name: 'erros.xlsx', buffer: await xlsx(sheets) }] });
    assert.equal(p.status, 201);
    const pv = p.body.import.preview;
    assert.ok(pv.errorCount >= 10, `errorCount=${pv.errorCount}`);
    const issue = (sheet, row, column) => pv.sheets.find((s) => s.sheet === sheet).rows.find((r) => r.row === row).issues.find((i) => i.column === column);
    assert.match(issue('TRIPS', 2, 'trip_id').message, /Identificador inválido/);
    assert.match(issue('TRIPS', 2, 'start_date').hint, /AAAA-MM-DD/);
    assert.match(issue('TRIPS', 2, 'timezone').hint, /IANA/);
    assert.match(issue('TRAVELERS', 2, 'traveler_email').message, /E-mail inválido/);
    assert.match(issue('TRAVELERS', 3, 'trip_id').message, /não existe/);
    assert.match(issue('FLIGHTS', 2, 'departure_datetime').message, /Data e hora inválidas/);
    assert.match(pv.sheets.find((s) => s.sheet === 'FLIGHTS').rows[2].issues[0].message, /Linha repetida/);
    assert.match(issue('ACCOMMODATIONS', 2, 'checkout_datetime').message, /check-out/);
    assert.match(issue('DOCUMENTS', 2, 'category').hint, /voucher/);
    assert.match(issue('DOCUMENTS', 2, 'visible_to_traveler').hint, /sim/);
    assert.ok(pv.fileIssues.some((i) => /PLANILHA_ESTRANHA/.test(i.message)));

    const c = await t.call('POST', `/api/admin/imports/${p.body.import.id}/confirm`, { token: admin, body: {} });
    assert.equal(c.status, 409);
    assert.equal(t.db.prepare("SELECT COUNT(*) n FROM flight_segments").get().n, 2);

    const csv = await t.call('GET', `/api/admin/imports/${p.body.import.id}/errors.csv`, { token: admin });
    assert.equal(csv.status, 200);
    assert.match(csv.body, /aba;linha;coluna;valor;gravidade;problema;como corrigir/);
    assert.match(csv.body, /TRAVELERS;2;traveler_email;ana-sem-arroba.com;ERRO/);

    const ann = await t.call('GET', `/api/admin/imports/${p.body.import.id}/annotated.xlsx`, { token: admin, raw: true });
    assert.equal(ann.status, 200);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(await ann.arrayBuffer()));
    const ws = wb.getWorksheet('TRAVELERS');
    assert.equal(ws.getRow(1).getCell(4).value, 'ERROS');
    assert.match(String(ws.getRow(2).getCell(4).value), /E-mail inválido/);
  } finally {
    await t.close();
  }
});

test('coluna obrigatória ausente e arquivo em formato errado', async () => {
  const t = await startTestApp();
  try {
    const admin = await t.login('admin@vagari.test');
    const p = await preview(t, admin, {
      kind: 'content',
      spreadsheets: [
        { name: 'c.xlsx', buffer: await xlsx({ DESTINATIONS: [['destination_id', 'city'], ['roma', 'Roma']] }) },
        { name: 'velho.xls', buffer: Buffer.from('x') },
      ],
    });
    const msgs = p.body.import.preview.fileIssues.map((i) => i.message).join(' | ');
    assert.match(msgs, /\.xls/);
    // Registro novo sem a coluna obrigatória: erro na linha, explicando que a coluna falta.
    const row = p.body.import.preview.sheets[0].rows[0];
    assert.equal(row.action, 'error');
    assert.equal(row.issues[0].column, 'country');
    assert.match(row.issues[0].message, /Coluna obrigatória ausente/);
    // Sem a coluna-chave a aba inteira é recusada.
    const p2 = await preview(t, admin, { kind: 'content', spreadsheets: [{ name: 'c.xlsx', buffer: await xlsx({ PLACES: [['name'], ['X']] }) }] });
    assert.ok(p2.body.import.preview.fileIssues.some((i) => i.message.includes('coluna obrigatória "content_id"')));
    const c = await t.call('POST', `/api/admin/imports/${p.body.import.id}/confirm`, { token: admin, body: {} });
    assert.equal(c.status, 422);
  } finally {
    await t.close();
  }
});

test('CSV com ponto e vírgula, acentos em Windows-1252 e viagem escolhida no upload', async () => {
  const { t, admin } = await seededApp();
  try {
    const text = 'title;due_date;priority;description\r\nComprar adaptador;15/12/2026;Média;Tomada tipo L (Itália)\r\n';
    const buffer = Buffer.from(new Uint8Array([...text].map((ch) => ch.charCodeAt(0)))); // latin1 ≈ cp1252 aqui
    const p = await preview(t, admin, { kind: 'trip', trip_id: 'VG-001', spreadsheets: [{ name: 'tarefas.csv', buffer }], sheet: 'TASKS' });
    assert.equal(p.status, 201, JSON.stringify(p.body));
    assert.equal(p.body.import.preview.errorCount, 0, JSON.stringify(p.body.import.preview));
    await t.call('POST', `/api/admin/imports/${p.body.import.id}/confirm`, { token: admin, body: {} });
    const task = t.db.prepare("SELECT * FROM tasks WHERE title = 'Comprar adaptador'").get();
    assert.equal(task.trip_id, 'VG-001');
    assert.equal(task.due_date, '2026-12-15');
    assert.equal(task.priority, 'media');
    assert.equal(task.description, 'Tomada tipo L (Itália)');

    // Linha de outra viagem num upload direcionado: erro.
    const wrong = Buffer.from('trip_id;title\nVG-999;Outra\n');
    const p2 = await preview(t, admin, { kind: 'trip', trip_id: 'VG-001', spreadsheets: [{ name: 'TASKS.csv', buffer: wrong }] });
    assert.match(JSON.stringify(p2.body.import.preview), /Esta importação é da viagem VG-001/);
  } finally {
    await t.close();
  }
});

test('célula vazia mantém o valor; [limpar] apaga; nada é excluído por ausência', async () => {
  const { t, admin } = await seededApp();
  try {
    await importAndConfirm(t, admin, {
      kind: 'trip',
      sheets: { TRIPS: [['trip_id', 'general_notes'], ['VG-001', 'Levar adaptador.']] },
    });
    assert.equal(t.db.prepare("SELECT general_notes FROM trips WHERE id = 'VG-001'").get().general_notes, 'Levar adaptador.');
    await importAndConfirm(t, admin, { kind: 'trip', sheets: { TRIPS: [['trip_id', 'trip_name', 'general_notes'], ['VG-001', 'Itália 2026', '']] } });
    const trip = t.db.prepare("SELECT * FROM trips WHERE id = 'VG-001'").get();
    assert.equal(trip.general_notes, 'Levar adaptador.');
    assert.equal(trip.name, 'Itália 2026');
    assert.equal(trip.status, 'published', 'status vazio não volta para rascunho');
    await importAndConfirm(t, admin, { kind: 'trip', sheets: { TRIPS: [['trip_id', 'general_notes'], ['VG-001', '[limpar]']] } });
    assert.equal(t.db.prepare("SELECT general_notes FROM trips WHERE id = 'VG-001'").get().general_notes, null);
  } finally {
    await t.close();
  }
});

test('possível duplicidade é sinalizada na prévia (hospedagem com check-in alterado sem ID)', async () => {
  const { t, admin } = await seededApp();
  try {
    const sheets = {
      ACCOMMODATIONS: [
        ['trip_id', 'property_name', 'checkin_datetime', 'checkout_datetime'],
        ['VG-001', 'Hotel Exemplo Roma', '2026-12-22 15:00', '2027-01-04 08:00'],
      ],
    };
    const p = await preview(t, admin, { kind: 'trip', spreadsheets: [{ name: 'h.xlsx', buffer: await xlsx(sheets) }] });
    const row = p.body.import.preview.sheets[0].rows[0];
    assert.equal(row.action, 'create');
    const w = row.issues.find((i) => /Possível duplicidade/.test(i.message));
    assert.ok(w, JSON.stringify(row.issues));
    assert.match(w.hint, /accommodation_id = hotel_exemplo_roma.2026-12-21/);
  } finally {
    await t.close();
  }
});

test('a confirmação recalcula o plano: se o banco mudou e gerou erro, nada é gravado', async () => {
  const t = await startTestApp();
  try {
    const admin = await t.login('admin@vagari.test');
    await importAndConfirm(t, admin, { kind: 'content', sheets: { DESTINATIONS: CONTENT_SHEETS.DESTINATIONS.slice(0, 2) } });
    const p = await preview(t, admin, { kind: 'trip', spreadsheets: [{ name: 'v.xlsx', buffer: await xlsx({ TRIPS: TRIP_SHEETS().TRIPS }) }] });
    assert.equal(p.body.import.preview.errorCount, 0);
    t.db.prepare("DELETE FROM destinations WHERE id = 'italia'").run();
    const c = await t.call('POST', `/api/admin/imports/${p.body.import.id}/confirm`, { token: admin, body: {} });
    assert.equal(c.status, 409);
    assert.ok(c.body.preview.errorCount > 0);
    assert.equal(t.db.prepare('SELECT COUNT(*) n FROM trips').get().n, 0);
  } finally {
    await t.close();
  }
});

test('modelos para download: XLSX com abas e instruções, CSV por aba', async () => {
  const t = await startTestApp();
  try {
    const admin = await t.login('admin@vagari.test');
    const res = await t.call('GET', '/api/admin/templates/viagem.xlsx', { token: admin, raw: true });
    assert.equal(res.status, 200);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(await res.arrayBuffer()));
    assert.deepEqual(
      wb.worksheets.map((w) => w.name),
      ['LEIA-ME', 'CAMPOS', 'TRIPS', 'TRAVELERS', 'FLIGHTS', 'ACCOMMODATIONS', 'ITINERARY', 'DOCUMENTS', 'TASKS'],
    );
    assert.equal(wb.getWorksheet('FLIGHTS').getRow(1).getCell(1).value, 'trip_id');
    // O modelo vazio, reenviado, não gera linhas (abas vazias são ignoradas).
    const p = await preview(t, admin, { kind: 'trip', spreadsheets: [{ name: 'modelo.xlsx', buffer: Buffer.from(await (await t.call('GET', '/api/admin/templates/viagem.xlsx', { token: admin, raw: true })).arrayBuffer()) }] });
    assert.match(JSON.stringify(p.body.import.preview.fileIssues), /Nenhuma linha de dados/);
    const csv = await t.call('GET', '/api/admin/templates/csv/places.csv', { token: admin });
    assert.match(csv.body, /content_id;destination_id;name;category/);
  } finally {
    await t.close();
  }
});

test('exportar a viagem e reimportar o arquivo exportado não muda nada', async () => {
  const { t, admin } = await seededApp();
  try {
    const res = await t.call('GET', '/api/admin/trips/VG-001/export.xlsx', { token: admin, raw: true });
    assert.equal(res.status, 200);
    const buffer = Buffer.from(await res.arrayBuffer());
    const p = await preview(t, admin, { kind: 'trip', spreadsheets: [{ name: 'export.xlsx', buffer }] });
    assert.equal(p.body.import.preview.errorCount, 0, JSON.stringify(p.body.import.preview.sheets.flatMap((s) => s.rows.flatMap((r) => r.issues))));
    for (const s of p.body.import.preview.sheets) assert.equal(s.counts.unchanged, s.rows.length, `${s.sheet}: ${JSON.stringify(s.rows.map((r) => r.changes))}`);
  } finally {
    await t.close();
  }
});
