import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { loadConfig } from '../server/config.js';
import { openDatabase } from '../server/db.js';
import { createServices } from '../server/services/index.js';
import { createApp } from '../server/app.js';

export const DAY = 86_400_000;
// "Hoje" nos testes: 1º de outubro de 2026, 12h UTC.
export const T0 = Date.UTC(2026, 9, 1, 12);

export const PDF = (text = 'x') => Buffer.from(`%PDF-1.4\n% ${text}\n%%EOF\n`);
export const PNG = () => Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

/** App completo com banco em memória, pasta temporária, e-mail capturado e relógio controlável. */
export async function startTestApp(env = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vagari-test-'));
  const clock = { t: T0, now: () => clock.t, advanceDays(d) { clock.t += d * DAY; } };
  const config = loadConfig({
    PUBLIC_URL: 'https://app.vagari.test',
    APP_SECRET: 'x'.repeat(40),
    ADMIN_EMAILS: 'admin@vagari.test',
    STORAGE_DIR: path.join(dir, 'files'),
    TMP_DIR: path.join(dir, 'tmp'),
    ...env,
  });
  const emails = [];
  const mailer = { async send(m) { emails.push(m); } };
  const logs = [];
  const log = { info: (m) => logs.push(m), error: (m) => logs.push(m) };
  const services = createServices(config, { db: openDatabase(':memory:'), mailer, now: clock.now, log });
  const app = createApp(services);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  async function call(method, url, { token, body, form, raw = false, headers = {} } = {}) {
    const h = { ...headers };
    if (token) h.Authorization = `Bearer ${token}`;
    let payload;
    if (form) payload = form;
    else if (body !== undefined) {
      h['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    const res = await fetch(base + url, { method, headers: h, body: payload, redirect: 'manual' });
    if (raw) return res;
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }
    return { status: res.status, body: json, headers: res.headers };
  }

  /** Faz login por código de e-mail e devolve o token. */
  async function login(email) {
    const before = emails.length;
    const r = await call('POST', '/api/auth/request-code', { body: { email } });
    if (r.status !== 200) throw new Error(`request-code ${r.status}`);
    const mail = emails.slice(before).find((m) => m.to === email);
    if (!mail) throw new Error(`sem e-mail para ${email}`);
    const code = mail.subject.match(/(\d{6})/)[1];
    const v = await call('POST', '/api/auth/verify-code', { body: { email, code } });
    if (v.status !== 200) throw new Error(`verify ${v.status} ${JSON.stringify(v.body)}`);
    return v.body.token;
  }

  async function close() {
    await new Promise((r) => server.close(r));
    fs.rmSync(dir, { recursive: true, force: true });
  }

  return { services, db: services.db, call, login, emails, clock, logs, close, base };
}

/** Planilha .xlsx a partir de { ABA: [[cabeçalho...], [linha...], ...] }. */
export async function xlsx(sheets) {
  const wb = new ExcelJS.Workbook();
  for (const [name, rows] of Object.entries(sheets)) {
    const ws = wb.addWorksheet(name);
    for (const r of rows) ws.addRow(r);
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Monta o multipart do upload de importação. */
export function importForm({ kind, spreadsheets = [], attachments = [], trip_id, sheet }) {
  const form = new FormData();
  form.append('kind', kind);
  if (trip_id) form.append('trip_id', trip_id);
  if (sheet) form.append('sheet', sheet);
  for (const s of spreadsheets) form.append('spreadsheets', new Blob([s.buffer]), s.name);
  for (const a of attachments) form.append('attachments', new Blob([a.buffer]), a.name);
  return form;
}

export const CONTENT_SHEETS = {
  DESTINATIONS: [
    ['destination_id', 'country', 'region', 'city', 'timezone', 'parent_id'],
    ['italia', 'Itália', '', '', 'Europe/Rome', ''],
    ['roma', 'Itália', 'Lácio', 'Roma', 'Europe/Rome', 'italia'],
    ['brasil', 'Brasil', '', '', 'America/Sao_Paulo', ''],
    ['rio', 'Brasil', 'RJ', 'Rio de Janeiro', 'America/Sao_Paulo', 'brasil'],
  ],
  PLACES: [
    ['content_id', 'destination_id', 'name', 'category', 'short_description', 'address', 'latitude', 'longitude', 'tags', 'source_url', 'last_verified_at', 'status'],
    ['roma-coliseu', 'roma', 'Coliseu', 'Ponto turístico', 'Anfiteatro.', 'Piazza del Colosseo, 1, Roma', '41.8902', '12.4922', 'história, ao ar livre', 'https://example.org/coliseu', '2026-09-30', 'pendente'],
    ['roma-cafe', 'roma', 'Café Exemplo', 'cafe', 'Café clássico.', 'Via Exemplo, 2, Roma', '41.9', '12.47', 'café', 'https://example.org/cafe', '2026-09-30', 'pendente'],
  ],
  MEDIA: [
    ['content_id', 'image_url_or_upload_name', 'alt_text', 'display_order', 'rights_notes'],
    ['roma-coliseu', 'coliseu.png', 'Coliseu ao entardecer', '1', 'Foto própria'],
  ],
};

export const TRIP_SHEETS = (tripId = 'VG-001', email = 'ana@example.com') => ({
  TRIPS: [
    ['trip_id', 'trip_name', 'destination_id', 'start_date', 'end_date', 'timezone', 'status', 'trip_type'],
    [tripId, 'Itália em família', 'italia', '20/12/2026', '2027-01-04', '', 'published', 'familia'],
  ],
  TRAVELERS: [
    ['trip_id', 'traveler_email', 'traveler_name', 'role'],
    [tripId, email, 'Ana Souza', 'titular'],
    [tripId, 'bia@example.com', 'Bia Souza', 'criança'],
  ],
  FLIGHTS: [
    ['trip_id', 'segment_order', 'airline', 'flight_number', 'departure_airport', 'departure_datetime', 'arrival_airport', 'arrival_datetime', 'booking_reference'],
    [tripId, '1', 'ITA Airways', 'AZ 675', 'GRU', '20/12/2026 22:40', 'FCO', '21/12/2026 14:55', 'ABC123'],
    [tripId, '2', 'ITA Airways', 'AZ 674', 'FCO', '2027-01-04 10:00', 'GRU', '2027-01-04 18:00', 'ABC123'],
  ],
  ACCOMMODATIONS: [
    ['trip_id', 'city_id', 'property_name', 'checkin_datetime', 'checkout_datetime', 'address', 'latitude', 'longitude'],
    [tripId, 'roma', 'Hotel Exemplo Roma', '2026-12-21 15:00', '2027-01-04 08:00', 'Via Exemplo, 10, Roma', '41.9028', '12.4964'],
  ],
  ITINERARY: [
    ['trip_id', 'date', 'start_time', 'end_time', 'city_id', 'title', 'category', 'address', 'booking_status'],
    [tripId, '2026-12-22', '09:30', '12:00', 'roma', 'Visita guiada ao Coliseu', 'passeio', 'Piazza del Colosseo, 1, Roma', 'confirmado'],
  ],
  DOCUMENTS: [
    ['trip_id', 'category', 'file_name', 'file_url_or_upload_name', 'visible_to_traveler', 'stage'],
    [tripId, 'voucher', 'Voucher do hotel', 'voucher-hotel.pdf', 'sim', 'destino'],
    [tripId, 'outro', 'Contrato com fornecedor', 'contrato.pdf', 'não', ''],
  ],
  TASKS: [
    ['trip_id', 'title', 'due_date', 'priority'],
    [tripId, 'Escolher horário do Vaticano', '2026-11-30', 'alta'],
  ],
});

/** Atalho: importa e confirma; devolve o job final. */
export async function importAndConfirm(t, token, { kind, sheets, attachments = [], notify = false }) {
  const buffer = await xlsx(sheets);
  const p = await t.call('POST', '/api/admin/imports', { token, form: importForm({ kind, spreadsheets: [{ name: 'dados.xlsx', buffer }], attachments }) });
  if (p.status !== 201) throw new Error(`preview ${p.status} ${JSON.stringify(p.body)}`);
  if (p.body.import.preview.errorCount) throw new Error(`preview com erros: ${JSON.stringify(p.body.import.preview, null, 1)}`);
  const c = await t.call('POST', `/api/admin/imports/${p.body.import.id}/confirm`, { token, body: { notify } });
  if (c.status !== 200) throw new Error(`confirm ${c.status} ${JSON.stringify(c.body)}`);
  return c.body.import;
}

/** Ambiente com conteúdo + uma viagem publicada importados. */
export async function seededApp(env) {
  const t = await startTestApp(env);
  const admin = await t.login('admin@vagari.test');
  await importAndConfirm(t, admin, { kind: 'content', sheets: CONTENT_SHEETS, attachments: [{ name: 'coliseu.png', buffer: PNG() }] });
  await importAndConfirm(t, admin, {
    kind: 'trip',
    sheets: TRIP_SHEETS(),
    attachments: [
      { name: 'voucher-hotel.pdf', buffer: PDF('voucher') },
      { name: 'contrato.pdf', buffer: PDF('contrato') },
    ],
  });
  return { t, admin };
}
