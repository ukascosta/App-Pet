/**
 * Definição das entidades importáveis/editáveis.
 *
 * A MESMA definição serve à importação em lote (XLSX/CSV) e aos formulários do painel:
 * colunas, tipos, obrigatoriedade, validações cruzadas, chave estável para atualizar sem duplicar
 * e a forma de gravar no banco. Assim um dado nunca é aceito por um caminho e recusado pelo outro.
 *
 * Convenções dos valores normalizados (v):
 *   undefined → coluna ausente ou célula vazia: mantém o valor atual (nunca apaga por omissão)
 *   null      → célula com "[limpar]" (ou null no formulário): apaga o campo opcional
 */
import { newId } from '../lib/ids.js';
import { audit } from '../lib/audit.js';
import { addDays } from '../lib/time.js';
import * as V from '../lib/values.js';
import { sniffFile, DOCUMENT_TYPES, IMAGE_TYPES } from '../services/storage.js';

export const CLEAR_TOKEN = '[limpar]';

const err = (column, message, hint) => ({ severity: 'error', column, message, hint });
const warn = (column, message, hint) => ({ severity: 'warning', column, message, hint });

const TRIP_STATUS = [
  { key: 'draft', label: 'Rascunho', aliases: ['rascunho'] },
  { key: 'published', label: 'Publicada', aliases: ['publicada', 'publicado', 'ativa'] },
  { key: 'archived', label: 'Arquivada', aliases: ['arquivada', 'concluida', 'encerrada'] },
  { key: 'canceled', label: 'Cancelada', aliases: ['cancelada', 'cancelled'] },
];
const TRAVELER_ROLES = [
  { key: 'titular', label: 'Titular', aliases: ['principal', 'responsavel', 'lead'] },
  { key: 'acompanhante', label: 'Acompanhante', aliases: ['adulto', 'adult', 'companion'] },
  { key: 'crianca', label: 'Criança', aliases: ['child', 'menor', 'infant', 'bebe'] },
];
const PRIORITIES = [
  { key: 'alta', label: 'Alta', aliases: ['high', 'urgente'] },
  { key: 'media', label: 'Média', aliases: ['medium', 'normal'] },
  { key: 'baixa', label: 'Baixa', aliases: ['low'] },
];
const PRICE_LEVELS = [
  { key: '$', label: 'Econômico', aliases: ['1', 'economico', 'barato'] },
  { key: '$$', label: 'Moderado', aliases: ['2', 'moderado', 'medio'] },
  { key: '$$$', label: 'Alto', aliases: ['3', 'alto', 'caro'] },
  { key: '$$$$', label: 'Luxo', aliases: ['4', 'luxo', 'muito caro'] },
];
const PLACE_STATUS = [
  { key: 'pending_review', label: 'Pendente de revisão', aliases: ['pendente', 'pendente de revisao humana', 'pending'] },
  { key: 'approved', label: 'Aprovado', aliases: ['aprovado', 'publicado'] },
  { key: 'archived', label: 'Arquivado', aliases: ['arquivado', 'fechado', 'inativo'] },
];

export const ENUMS = { TRIP_STATUS, TRAVELER_ROLES, PRIORITIES, PRICE_LEVELS, PLACE_STATUS };

// ---------------------------------------------------------------- normalização de linha

function parseByType(c, raw, ctx) {
  switch (c.type) {
    case 'text': {
      const s = V.asText(raw);
      if (c.max && s.length > c.max)
        return { error: `Texto com ${s.length} caracteres; o limite é ${c.max}.`, hint: 'Resuma o texto.' };
      return { value: s };
    }
    case 'id':
      return V.parseStableId(raw);
    case 'date':
      return V.parseDate(raw);
    case 'time':
      return V.parseTime(raw);
    case 'datetime':
      return V.parseDateTime(raw, { allowDateOnly: c.allowDateOnly });
    case 'email':
      return V.parseEmail(raw);
    case 'url':
      return V.parseUrl(raw);
    case 'int':
      return V.parseInteger(raw, { min: c.min, max: c.max });
    case 'decimal':
      return V.parseDecimal(raw, { min: c.min, max: c.max });
    case 'bool':
      return V.parseBool(raw);
    case 'timezone':
      return V.parseTimeZone(raw);
    case 'phone':
      return V.parsePhone(raw);
    case 'tags':
      return V.parseTags(raw);
    case 'enum':
      return V.parseEnum(raw, typeof c.options === 'string' ? ctx.settings[c.options] : c.options);
    case 'airport': {
      const s = V.asText(raw).toUpperCase();
      if (!/^[A-Z]{3}$/.test(s))
        return { error: `Aeroporto inválido: "${V.asText(raw)}".`, hint: 'Use o código IATA de 3 letras (ex.: GRU, FCO, CDG).' };
      return { value: s };
    }
    case 'source': {
      // Nome de arquivo enviado junto ou link https.
      const s = raw && typeof raw === 'object' && raw.hyperlink ? raw.hyperlink : V.asText(raw);
      return { value: s };
    }
    default:
      throw new Error(`tipo desconhecido ${c.type}`);
  }
}

/** Converte as células de uma linha em valores normalizados + problemas encontrados. */
export function normalizeRow(entity, cells, ctx) {
  const values = {};
  const issues = [];
  for (const c of entity.columns) {
    let raw = cells[c.key];
    if (c.key === 'trip_id' && ctx.targetTripId && (raw === undefined || V.isBlank(raw))) raw = ctx.targetTripId;
    if (raw === null || (typeof raw === 'string' && raw.trim().toLowerCase() === CLEAR_TOKEN)) {
      if (c.required) issues.push(err(c.key, 'Campo obrigatório: não pode ser apagado.', c.help));
      else values[c.key] = null;
      continue;
    }
    if (raw === undefined || V.isBlank(raw)) {
      if (c.required && !(c.requiredUnless && c.requiredUnless(cells, ctx))) {
        // Campos que identificam o registro são sempre obrigatórios. Os demais só para CRIAR:
        // numa atualização, vazio = manter o valor atual (o planejamento descarta estes erros).
        const isKey = entity.keyColumns.includes(c.key);
        const absent = !(c.key in cells) && ctx.source !== 'panel';
        const message = absent ? 'Coluna obrigatória ausente na planilha.' : 'Campo obrigatório vazio.';
        const hint = absent
          ? `Inclua a coluna "${c.key}": ela é necessária ${isKey ? 'para identificar o registro' : 'para criar um registro novo'}. ${c.help}`
          : c.help;
        issues.push({ ...err(c.key, message, hint), ...(isKey ? {} : { deferred: true }) });
      }
      values[c.key] = undefined;
      continue;
    }
    const r = parseByType(c, raw, ctx);
    if (r.error) issues.push({ ...err(c.key, r.error, r.hint), value: V.asText(raw) });
    else values[c.key] = r.value;
  }
  if (ctx.targetTripId && values.trip_id && values.trip_id !== ctx.targetTripId) {
    issues.push(
      err('trip_id', `Esta importação é da viagem ${ctx.targetTripId}, mas a linha é da viagem ${values.trip_id}.`, 'Corrija o trip_id ou importe sem escolher uma viagem.'),
    );
  }
  return { values, issues };
}

// ---------------------------------------------------------------- utilitários

/** Monta o registro do banco: valor informado > valor atual > padrão. */
function mapped(map, v, existing, defaults = {}) {
  const rec = {};
  for (const [sk, colName, conv] of map) {
    if (v[sk] !== undefined) rec[colName] = conv && v[sk] !== null ? conv(v[sk]) : v[sk];
    else if (existing) rec[colName] = existing[colName];
    else rec[colName] = defaults[colName] ?? null;
  }
  return rec;
}

function unmapped(map, row, back = {}) {
  const v = {};
  for (const [sk, colName] of map) v[sk] = back[colName] ? back[colName](row[colName]) : row[colName];
  return v;
}

export const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const bool01 = (b) => (b ? 1 : 0);

function tripMustExist(v, ctx, issues) {
  if (!v.trip_id) return null;
  const trip = ctx.trip(v.trip_id);
  if (!trip)
    issues.push(
      err('trip_id', `A viagem "${v.trip_id}" não existe.`, 'Inclua a viagem na aba TRIPS desta planilha ou crie-a antes no painel.'),
    );
  return trip;
}

function cityMustExist(v, ctx, issues, key = 'city_id') {
  if (v[key] && !ctx.destinationExists(v[key]))
    issues.push(
      err(key, `O destino "${v[key]}" não existe na biblioteca.`, 'Cadastre-o em Conteúdo › Destinos (ou importe a planilha de conteúdo) antes.'),
    );
}

function dateInsideTrip(date, trip, column, label, issues, slack = 1) {
  if (!date || !trip?.start_date) return;
  const d = date.slice(0, 10);
  if (d < addDays(trip.start_date, -slack) || d > addDays(trip.end_date, slack))
    issues.push(
      warn(column, `${label} (${d}) fora das datas da viagem (${trip.start_date} a ${trip.end_date}).`, 'Confira se a data está certa.'),
    );
}

/** Origem de arquivo: link https, anexo enviado agora ou arquivo já existente com o mesmo nome. */
function checkSource(v, key, existing, ctx, allowed, issues) {
  const src = v[key];
  if (!src) return;
  if (/^https?:\/\//i.test(src)) {
    const u = V.parseUrl(src);
    if (u.error) issues.push(err(key, u.error, u.hint));
    else issues.push(warn(key, 'Arquivo por link externo.', 'Prefira enviar o arquivo pelo painel: links podem expirar ou ser públicos.'));
    return;
  }
  const att = ctx.attachment(src);
  if (att) {
    const s = sniffFile(att.name, att.read(), allowed);
    if (s.error) issues.push(err(key, s.error, `Tipos aceitos: ${allowed.join(', ')}.`));
    return;
  }
  if (existing && existing.source_name && existing.source_name.toLowerCase() === src.toLowerCase() && existing.storage_key) return;
  issues.push(
    err(key, `O arquivo "${src}" não foi enviado junto com a planilha.`, 'Anexe o arquivo com exatamente esse nome no upload, ou use um link https.'),
  );
}

/** Grava o arquivo da origem (se for anexo novo) e devolve os campos de arquivo. */
function storeSource(v, key, existing, ctx) {
  const src = v[key];
  if (src === undefined) return null;
  if (/^https?:\/\//i.test(src)) {
    if (existing && existing.external_url === src && !existing.storage_key) return null;
    return { storage_key: null, external_url: src, mime_type: null, size_bytes: null, sha256: null, source_name: src };
  }
  const att = ctx.attachment(src);
  if (!att) return null; // mantém o arquivo atual
  if (existing && existing.sha256 && existing.sha256 === att.sha256) {
    return existing.source_name === src ? null : { source_name: src };
  }
  const buffer = att.read();
  const { mime } = sniffFile(att.name, buffer, [...DOCUMENT_TYPES, ...IMAGE_TYPES]);
  const storage_key = ctx.storage.putBuffer(buffer);
  ctx.createdFiles.push(storage_key);
  return { storage_key, external_url: null, mime_type: mime, size_bytes: buffer.length, sha256: att.sha256, source_name: src };
}

function fileChanged(v, key, existing, ctx) {
  const src = v[key];
  if (!src || !existing) return null;
  if (/^https?:\/\//i.test(src)) return existing.external_url === src ? null : { from: existing.source_name, to: src };
  const att = ctx.attachment(src);
  if (att && att.sha256 !== existing.sha256) return { from: existing.source_name || '(link)', to: `${src} (novo arquivo)` };
  return null;
}

// ---------------------------------------------------------------- aplicação genérica

/** Insere ou atualiza conforme a chave estável, registrando no histórico. */
export function genericApply(entity, db, v, ctx) {
  const existing = ctx.forceExisting || entity.find(db, v, ctx);
  const rec = entity.toDb(v, existing, ctx);
  const now = ctx.nowIso;
  const tripId = entity.tripOf ? entity.tripOf(v, existing) : (v.trip_id ?? existing?.trip_id ?? null);
  if (existing) {
    const changed = Object.keys(rec).filter((c) => !same(rec[c], existing[c]));
    if (!changed.length) return { action: 'unchanged', id: existing.id, before: existing, after: existing };
    db.prepare(`UPDATE ${entity.table} SET ${changed.map((c) => `${c} = ?`).join(', ')}, updated_at = ? WHERE id = ?`).run(
      ...changed.map((c) => rec[c]),
      now,
      existing.id,
    );
    const after = db.prepare(`SELECT * FROM ${entity.table} WHERE id = ?`).get(existing.id);
    audit(db, {
      actorId: ctx.actorId,
      entityType: entity.entityType,
      entityId: existing.id,
      tripId,
      action: 'update',
      before: pick(existing, changed),
      after: pick(after, changed),
      source: ctx.source,
    });
    return { action: 'update', id: existing.id, before: existing, after, changed };
  }
  const id = entity.naturalId ? v[entity.naturalId] : newId(entity.idPrefix);
  const row = { id, ...rec, created_at: now, updated_at: now };
  const cols = Object.keys(row);
  db.prepare(`INSERT INTO ${entity.table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`).run(
    ...cols.map((c) => row[c]),
  );
  audit(db, { actorId: ctx.actorId, entityType: entity.entityType, entityId: id, tripId, action: 'create', after: row, source: ctx.source });
  return { action: 'create', id, before: null, after: row };
}

const pick = (o, keys) => Object.fromEntries(keys.map((k) => [k, o?.[k] ?? null]));

// ---------------------------------------------------------------- entidades de viagem

const TRIP_MAP = [
  ['trip_name', 'name'],
  ['destination_id', 'destination_id'],
  ['start_date', 'start_date'],
  ['end_date', 'end_date'],
  ['timezone', 'timezone'],
  ['status', 'status'],
  ['trip_type', 'trip_type'],
  ['language', 'language'],
  ['cover_image_url', 'cover_image_url'],
  ['general_notes', 'general_notes'],
];

export const TRIPS = {
  keyColumns: ['trip_id'],
  map: TRIP_MAP,
  sheet: 'TRIPS',
  label: 'Viagens',
  aliases: ['VIAGENS', 'VIAGEM'],
  kind: 'trip',
  table: 'trips',
  entityType: 'trip',
  naturalId: 'trip_id',
  columns: [
    { key: 'trip_id', type: 'id', required: true, label: 'Código da viagem', example: 'VG-2026-001', help: 'Código interno estável da viagem. Não muda depois de criado.' },
    { key: 'trip_name', type: 'text', required: true, max: 120, label: 'Nome da viagem', example: 'Itália em família', help: 'Nome que o viajante verá.' },
    { key: 'destination_id', type: 'id', required: true, label: 'Destino', example: 'italia', help: 'destination_id cadastrado na biblioteca de conteúdo.' },
    { key: 'start_date', type: 'date', required: true, label: 'Início', example: '2026-12-20', help: 'Data de início (embarque).' },
    { key: 'end_date', type: 'date', required: true, label: 'Fim', example: '2027-01-04', help: 'Data de término (volta).' },
    {
      key: 'timezone', type: 'timezone', required: true, label: 'Fuso horário', example: 'Europe/Rome',
      help: 'Fuso principal do destino (nome IANA). Se vazio, usa o fuso cadastrado no destino.',
      requiredUnless: (cells, ctx) => !!ctx.destinationTimezone?.(V.asText(cells.destination_id)) || !!ctx.trip?.(V.asText(cells.trip_id))?.timezone,
    },
    { key: 'status', type: 'enum', options: TRIP_STATUS, label: 'Situação', example: 'draft', help: 'draft (rascunho, invisível ao viajante), published, archived ou canceled. Vazio mantém a atual (nova = draft).' },
    { key: 'cover_image_url', type: 'url', label: 'Imagem de capa', example: 'https://…/capa.jpg', help: 'Link https da imagem de capa.' },
    { key: 'general_notes', type: 'text', max: 4000, label: 'Observações gerais', example: 'Levar adaptador de tomada tipo L.', help: 'Aparece na tela inicial do viajante.' },
    { key: 'trip_type', type: 'enum', options: 'trip_types', label: 'Tipo de viagem', example: 'familia', help: 'Usado nas regras da jornada de preparação.' },
    { key: 'language', type: 'text', max: 40, label: 'Idioma do destino', example: 'Italiano', help: 'Opcional.' },
  ],
  rowKey: (v) => v.trip_id,
  describe: (v) => `${v.trip_id} · ${v.trip_name ?? ''}`,
  find: (db, v) => db.prepare('SELECT * FROM trips WHERE id = ?').get(v.trip_id),
  toDb(v, existing, ctx) {
    const rec = mapped(TRIP_MAP, v, existing, { status: 'draft' });
    if (!rec.timezone) rec.timezone = ctx.destinationTimezone(rec.destination_id);
    return rec;
  },
  fromDb: (row) => ({ trip_id: row.id, ...unmapped(TRIP_MAP, row) }),
  check(v, ctx, existing) {
    const issues = [];
    const start = v.start_date ?? existing?.start_date;
    const end = v.end_date ?? existing?.end_date;
    if (start && end && end < start) issues.push(err('end_date', 'A data de fim é anterior à de início.', 'Confira as datas.'));
    if (start && end && end >= start && (Date.parse(end) - Date.parse(start)) / 86_400_000 > 365)
      issues.push(warn('end_date', 'Viagem com mais de 1 ano.', 'Confira o ano das datas.'));
    if (v.destination_id && !ctx.destinationExists(v.destination_id))
      issues.push(err('destination_id', `O destino "${v.destination_id}" não existe na biblioteca.`, 'Cadastre-o em Conteúdo › Destinos antes.'));
    if (v.timezone === undefined && !existing && v.destination_id && !ctx.destinationTimezone(v.destination_id))
      issues.push(err('timezone', 'Informe o fuso horário.', 'O destino não tem fuso cadastrado; use o nome IANA (ex.: Europe/Rome).'));
    return issues;
  },
  apply: (db, v, ctx) => genericApply(TRIPS, db, v, ctx),
};

const TRAVELER_MAP = [
  ['traveler_name', 'name'],
  ['phone_optional', 'phone'],
  ['nationality', 'nationality'],
  ['role', 'traveler_role'],
];

export const TRAVELERS = {
  keyColumns: ['trip_id', 'traveler_email'],
  map: TRAVELER_MAP,
  sheet: 'TRAVELERS',
  label: 'Viajantes',
  aliases: ['VIAJANTES'],
  kind: 'trip',
  entityType: 'trip_traveler',
  columns: [
    { key: 'trip_id', type: 'id', required: true, label: 'Código da viagem', example: 'VG-2026-001', help: 'Viagem à qual o viajante será associado.' },
    { key: 'traveler_email', type: 'email', required: true, label: 'E-mail', example: 'ana@exemplo.com', help: 'E-mail usado para entrar no app.' },
    { key: 'traveler_name', type: 'text', required: true, max: 120, label: 'Nome', example: 'Ana Souza', help: 'Nome como deve aparecer no app.' },
    { key: 'role', type: 'enum', options: TRAVELER_ROLES, label: 'Papel', example: 'titular', help: 'titular, acompanhante ou crianca. Vazio = acompanhante.' },
    { key: 'phone_optional', type: 'phone', label: 'Telefone (opcional)', example: '+55 11 99999-0000', help: 'Com DDD.' },
    { key: 'nationality', type: 'text', max: 60, label: 'Nacionalidade (opcional)', example: 'Brasil', help: 'Ajusta as tarefas de documentação/entrada.' },
  ],
  rowKey: (v) => `${v.trip_id}|${v.traveler_email}`,
  describe: (v) => `${v.trip_id} · ${v.traveler_email}`,
  find: (db, v) =>
    db
      .prepare(
        `SELECT tt.*, u.email, u.name, u.phone, u.nationality FROM trip_travelers tt
         JOIN users u ON u.id = tt.user_id WHERE tt.trip_id = ? AND u.email = ?`,
      )
      .get(v.trip_id, v.traveler_email),
  toDb: (v, existing) => mapped(TRAVELER_MAP, v, existing, { traveler_role: 'acompanhante' }),
  fromDb: (row) => ({
    trip_id: row.trip_id,
    traveler_email: row.email,
    traveler_name: row.name,
    role: row.traveler_role,
    phone_optional: row.phone,
    nationality: row.nationality,
  }),
  check(v, ctx) {
    const issues = [];
    tripMustExist(v, ctx, issues);
    return issues;
  },
  apply(db, v, ctx) {
    const existing = ctx.forceExisting || TRAVELERS.find(db, v);
    const rec = TRAVELERS.toDb(v, existing);
    const now = ctx.nowIso;
    let user = db.prepare('SELECT * FROM users WHERE email = ?').get(v.traveler_email);
    if (!user) {
      const id = newId('usr_');
      db.prepare(
        `INSERT INTO users (id, email, name, phone, nationality, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'traveler', ?, ?)`,
      ).run(id, v.traveler_email, rec.name, rec.phone, rec.nationality, now, now);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
      audit(db, { actorId: ctx.actorId, entityType: 'user', entityId: id, action: 'create', after: { email: user.email, name: user.name }, source: ctx.source });
    } else {
      const changed = ['name', 'phone', 'nationality'].filter((k) => !same(rec[k], user[k]));
      if (changed.length) {
        db.prepare(`UPDATE users SET ${changed.map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`).run(
          ...changed.map((k) => rec[k]),
          now,
          user.id,
        );
        audit(db, { actorId: ctx.actorId, entityType: 'user', entityId: user.id, action: 'update', before: pick(user, changed), after: pick(rec, changed), source: ctx.source });
      }
    }
    if (!existing) {
      const id = newId('tt_');
      db.prepare(
        `INSERT INTO trip_travelers (id, trip_id, user_id, traveler_role, invitation_status, created_at, updated_at) VALUES (?, ?, ?, ?, 'not_sent', ?, ?)`,
      ).run(id, v.trip_id, user.id, rec.traveler_role, now, now);
      audit(db, { actorId: ctx.actorId, entityType: 'trip_traveler', entityId: id, tripId: v.trip_id, action: 'create', after: { email: user.email, traveler_role: rec.traveler_role }, source: ctx.source });
      return { action: 'create', id, userId: user.id };
    }
    if (existing.traveler_role !== rec.traveler_role) {
      db.prepare('UPDATE trip_travelers SET traveler_role = ?, updated_at = ? WHERE id = ?').run(rec.traveler_role, now, existing.id);
      audit(db, { actorId: ctx.actorId, entityType: 'trip_traveler', entityId: existing.id, tripId: v.trip_id, action: 'update', before: { traveler_role: existing.traveler_role }, after: { traveler_role: rec.traveler_role }, source: ctx.source });
    }
    return { action: 'update', id: existing.id, userId: user.id };
  },
};

const FLIGHT_MAP = [
  ['segment_order', 'segment_order'],
  ['airline', 'airline'],
  ['flight_number', 'flight_number'],
  ['departure_airport', 'departure_airport'],
  ['departure_datetime', 'departure_at'],
  ['arrival_airport', 'arrival_airport'],
  ['arrival_datetime', 'arrival_at'],
  ['booking_reference', 'booking_reference'],
  ['notes', 'notes'],
];

export const FLIGHTS = {
  keyColumns: ['trip_id', 'segment_order'],
  map: FLIGHT_MAP,
  sheet: 'FLIGHTS',
  label: 'Voos',
  aliases: ['VOOS', 'VOO'],
  kind: 'trip',
  table: 'flight_segments',
  entityType: 'flight_segment',
  idPrefix: 'flt_',
  columns: [
    { key: 'trip_id', type: 'id', required: true, label: 'Código da viagem', example: 'VG-2026-001', help: 'Viagem do trecho.' },
    { key: 'segment_order', type: 'int', min: 1, max: 99, required: true, label: 'Ordem do trecho', example: '1', help: 'Número do trecho na viagem (1, 2, 3…). É a chave para atualizar o trecho.' },
    { key: 'airline', type: 'text', max: 80, required: true, label: 'Companhia aérea', example: 'ITA Airways', help: 'Nome da companhia.' },
    { key: 'flight_number', type: 'text', max: 20, required: true, label: 'Número do voo', example: 'AZ 675', help: 'Código e número do voo.' },
    { key: 'departure_airport', type: 'airport', required: true, label: 'Aeroporto de partida', example: 'GRU', help: 'Código IATA de 3 letras.' },
    { key: 'departure_datetime', type: 'datetime', required: true, label: 'Partida (hora local)', example: '2026-12-20 22:40', help: 'Data e hora locais do aeroporto de partida.' },
    { key: 'arrival_airport', type: 'airport', required: true, label: 'Aeroporto de chegada', example: 'FCO', help: 'Código IATA de 3 letras.' },
    { key: 'arrival_datetime', type: 'datetime', required: true, label: 'Chegada (hora local)', example: '2026-12-21 14:55', help: 'Data e hora locais do aeroporto de chegada.' },
    { key: 'booking_reference', type: 'text', max: 40, label: 'Localizador', example: 'ABC123', help: 'Código da reserva (PNR).' },
    { key: 'notes', type: 'text', max: 2000, label: 'Observações', example: 'Bagagem: 1 peça de 23 kg.', help: 'Opcional.' },
  ],
  rowKey: (v) => `${v.trip_id}|${v.segment_order}`,
  describe: (v) => `${v.trip_id} · trecho ${v.segment_order} · ${v.flight_number ?? ''}`,
  find: (db, v) => db.prepare('SELECT * FROM flight_segments WHERE trip_id = ? AND segment_order = ?').get(v.trip_id, v.segment_order),
  toDb: (v, existing) => ({ trip_id: v.trip_id ?? existing.trip_id, ...mapped(FLIGHT_MAP, v, existing) }),
  fromDb: (row) => ({ trip_id: row.trip_id, ...unmapped(FLIGHT_MAP, row) }),
  check(v, ctx) {
    const issues = [];
    const trip = tripMustExist(v, ctx, issues);
    if (v.departure_datetime && v.arrival_datetime && v.arrival_datetime < v.departure_datetime)
      issues.push(
        warn('arrival_datetime', 'Chegada antes da partida (em hora local).', 'Só é normal em voos que cruzam fusos para o oeste. Confira as datas.'),
      );
    dateInsideTrip(v.departure_datetime, trip, 'departure_datetime', 'Partida', issues, 2);
    return issues;
  },
  apply: (db, v, ctx) => genericApply(FLIGHTS, db, v, ctx),
};

const ACCOMMODATION_MAP = [
  ['city_id', 'city_id'],
  ['property_name', 'name'],
  ['checkin_datetime', 'checkin_at'],
  ['checkout_datetime', 'checkout_at'],
  ['address', 'address'],
  ['latitude', 'latitude'],
  ['longitude', 'longitude'],
  ['confirmation_code', 'confirmation_code'],
  ['notes', 'notes'],
];

/** Chaves derivadas (quando a planilha não traz ID) também são IDs válidos, para poder reimportar o arquivo exportado. */
const slug = (s, max) => (V.normKey(s) || 'item').slice(0, max).replace(/_+$/, '');
const accommodationKey = (v) => v.accommodation_id || `${slug(v.property_name, 48)}.${String(v.checkin_datetime ?? '').slice(0, 10)}`;

export const ACCOMMODATIONS = {
  keyColumns: ['trip_id'],
  map: ACCOMMODATION_MAP,
  sheet: 'ACCOMMODATIONS',
  label: 'Hospedagens',
  aliases: ['HOSPEDAGENS', 'HOTEIS', 'HOSPEDAGEM'],
  kind: 'trip',
  table: 'accommodations',
  entityType: 'accommodation',
  idPrefix: 'acc_',
  columns: [
    { key: 'trip_id', type: 'id', required: true, label: 'Código da viagem', example: 'VG-2026-001', help: 'Viagem da hospedagem.' },
    { key: 'accommodation_id', type: 'id', label: 'ID da hospedagem (opcional)', example: 'roma-hotel', help: 'Opcional. Se vazio, a chave é nome + data de check-in. Use para poder mudar o check-in sem duplicar.' },
    { key: 'city_id', type: 'id', label: 'Cidade', example: 'roma', help: 'destination_id da cidade (opcional, mas ajuda nas recomendações).' },
    { key: 'property_name', type: 'text', max: 160, required: true, label: 'Hospedagem', example: 'Hotel Exemplo Roma', help: 'Nome do hotel/casa.' },
    { key: 'checkin_datetime', type: 'datetime', allowDateOnly: true, required: true, label: 'Check-in', example: '2026-12-21 15:00', help: 'Data (e hora, se souber) do check-in, no horário local.' },
    { key: 'checkout_datetime', type: 'datetime', allowDateOnly: true, required: true, label: 'Check-out', example: '2026-12-26 11:00', help: 'Data (e hora, se souber) do check-out.' },
    { key: 'address', type: 'text', max: 300, label: 'Endereço', example: 'Via Exemplo, 10, Roma', help: 'Endereço completo, para abrir no mapa.' },
    { key: 'confirmation_code', type: 'text', max: 60, label: 'Código de confirmação', example: '88776655', help: 'Opcional.' },
    { key: 'notes', type: 'text', max: 2000, label: 'Observações', example: 'Café da manhã incluso.', help: 'Opcional.' },
    { key: 'latitude', type: 'decimal', min: -90, max: 90, label: 'Latitude (opcional)', example: '41.9028', help: 'Permite sugerir lugares perto do hotel.' },
    { key: 'longitude', type: 'decimal', min: -180, max: 180, label: 'Longitude (opcional)', example: '12.4964', help: 'Permite sugerir lugares perto do hotel.' },
  ],
  rowKey: (v) => `${v.trip_id}|${accommodationKey(v)}`,
  describe: (v) => `${v.trip_id} · ${v.property_name ?? ''}`,
  find: (db, v) => db.prepare('SELECT * FROM accommodations WHERE trip_id = ? AND external_id = ?').get(v.trip_id, accommodationKey(v)),
  toDb: (v, existing) => ({
    trip_id: v.trip_id ?? existing.trip_id,
    external_id: existing?.external_id ?? accommodationKey(v),
    ...mapped(ACCOMMODATION_MAP, v, existing),
  }),
  fromDb: (row) => ({ trip_id: row.trip_id, accommodation_id: row.external_id, ...unmapped(ACCOMMODATION_MAP, row) }),
  check(v, ctx, existing, db) {
    const issues = [];
    const trip = tripMustExist(v, ctx, issues);
    cityMustExist(v, ctx, issues);
    const ci = v.checkin_datetime;
    const co = v.checkout_datetime;
    if (ci && co && co <= ci) issues.push(err('checkout_datetime', 'O check-out precisa ser depois do check-in.', 'Confira as datas.'));
    dateInsideTrip(ci, trip, 'checkin_datetime', 'Check-in', issues);
    if ((v.latitude == null) !== (v.longitude == null) && (v.latitude !== undefined || v.longitude !== undefined))
      issues.push(err('longitude', 'Informe latitude e longitude juntas.', 'Preencha as duas ou nenhuma.'));
    if (!existing && db && v.trip_id && v.property_name) {
      const similar = db
        .prepare('SELECT external_id, name, checkin_at FROM accommodations WHERE trip_id = ?')
        .all(v.trip_id)
        .filter((r) => V.normKey(r.name) === V.normKey(v.property_name));
      for (const r of similar)
        issues.push(
          warn('property_name', `Possível duplicidade: "${r.name}" já está cadastrada com check-in ${r.checkin_at}.`, `Se for a mesma hospedagem, preencha accommodation_id = ${r.external_id} para atualizar em vez de criar outra.`),
        );
    }
    return issues;
  },
  apply: (db, v, ctx) => genericApply(ACCOMMODATIONS, db, v, ctx),
};

const ITINERARY_MAP = [
  ['date', 'date'],
  ['start_time', 'start_time'],
  ['end_time', 'end_time'],
  ['city_id', 'city_id'],
  ['title', 'title'],
  ['category', 'category'],
  ['address', 'address'],
  ['description', 'description'],
  ['booking_status', 'booking_status'],
  ['confirmation_code', 'confirmation_code'],
  ['external_url', 'external_url'],
];

const itineraryKey = (v) => v.item_id || `${v.date}.${(v.start_time ?? '').replace(':', '') || 'dia'}.${slug(v.title, 44)}`;

export const ITINERARY = {
  keyColumns: ['trip_id'],
  map: ITINERARY_MAP,
  sheet: 'ITINERARY',
  label: 'Roteiro',
  aliases: ['ROTEIRO'],
  kind: 'trip',
  table: 'itinerary_items',
  entityType: 'itinerary_item',
  idPrefix: 'itn_',
  columns: [
    { key: 'trip_id', type: 'id', required: true, label: 'Código da viagem', example: 'VG-2026-001', help: 'Viagem do item.' },
    { key: 'item_id', type: 'id', label: 'ID do item (opcional)', example: 'd2-coliseu', help: 'Opcional. Se vazio, a chave é data + início + título.' },
    { key: 'date', type: 'date', required: true, label: 'Data', example: '2026-12-22', help: 'Dia da atividade.' },
    { key: 'start_time', type: 'time', label: 'Início', example: '09:30', help: 'Hora local (24h).' },
    { key: 'end_time', type: 'time', label: 'Fim', example: '12:00', help: 'Hora local (24h).' },
    { key: 'city_id', type: 'id', label: 'Cidade', example: 'roma', help: 'destination_id da cidade.' },
    { key: 'title', type: 'text', max: 160, required: true, label: 'Título', example: 'Visita guiada ao Coliseu', help: 'O que o viajante verá no roteiro.' },
    { key: 'category', type: 'enum', options: 'itinerary_categories', required: true, label: 'Categoria', example: 'passeio', help: 'Categoria do item (lista configurável no painel).' },
    { key: 'address', type: 'text', max: 300, label: 'Endereço', example: 'Piazza del Colosseo, 1, Roma', help: 'Para abrir no mapa.' },
    { key: 'description', type: 'text', max: 4000, label: 'Descrição', example: 'Encontro 15 min antes na entrada.', help: 'Detalhes e orientações.' },
    { key: 'booking_status', type: 'enum', options: 'booking_statuses', label: 'Situação da reserva', example: 'confirmado', help: 'confirmado, pendente, nao_necessario ou cancelado.' },
    { key: 'external_url', type: 'url', label: 'Link', example: 'https://…', help: 'Link oficial (opcional).' },
    { key: 'confirmation_code', type: 'text', max: 60, label: 'Código de confirmação', example: 'COL-5521', help: 'Opcional.' },
  ],
  rowKey: (v) => `${v.trip_id}|${itineraryKey(v)}`,
  describe: (v) => `${v.trip_id} · ${v.date ?? ''} ${v.start_time ?? ''} · ${v.title ?? ''}`,
  find: (db, v) => db.prepare('SELECT * FROM itinerary_items WHERE trip_id = ? AND external_id = ?').get(v.trip_id, itineraryKey(v)),
  toDb: (v, existing) => ({
    trip_id: v.trip_id ?? existing.trip_id,
    external_id: existing?.external_id ?? itineraryKey(v),
    ...mapped(ITINERARY_MAP, v, existing),
  }),
  fromDb: (row) => ({ trip_id: row.trip_id, item_id: row.external_id, ...unmapped(ITINERARY_MAP, row) }),
  check(v, ctx, existing, db) {
    const issues = [];
    const trip = tripMustExist(v, ctx, issues);
    cityMustExist(v, ctx, issues);
    dateInsideTrip(v.date, trip, 'date', 'Data', issues, 0);
    if (v.start_time && v.end_time && v.end_time < v.start_time)
      issues.push(warn('end_time', 'O fim é antes do início.', 'Só é normal se a atividade passa da meia-noite.'));
    if (!existing && db && v.trip_id && v.date && v.title) {
      const dupes = db
        .prepare('SELECT external_id, start_time, title FROM itinerary_items WHERE trip_id = ? AND date = ?')
        .all(v.trip_id, v.date)
        .filter((r) => V.normKey(r.title) === V.normKey(v.title));
      for (const r of dupes)
        issues.push(
          warn('title', `Possível duplicidade: "${r.title}" já existe neste dia (início ${r.start_time || 'sem horário'}).`, `Se for o mesmo item, preencha item_id = ${r.external_id}.`),
        );
    }
    return issues;
  },
  apply: (db, v, ctx) => genericApply(ITINERARY, db, v, ctx),
};

const DOCUMENT_MAP = [
  ['category', 'category'],
  ['file_name', 'title'],
  ['stage', 'stage'],
  ['visible_to_traveler', 'visible_to_traveler', bool01],
  ['notes', 'notes'],
];
const documentKey = (v) => v.document_id || slug(v.file_name, 60);

export const DOCUMENTS = {
  keyColumns: ['trip_id'],
  map: DOCUMENT_MAP,
  sheet: 'DOCUMENTS',
  label: 'Documentos',
  aliases: ['DOCUMENTOS'],
  kind: 'trip',
  table: 'documents',
  entityType: 'document',
  idPrefix: 'doc_',
  columns: [
    { key: 'trip_id', type: 'id', required: true, label: 'Código da viagem', example: 'VG-2026-001', help: 'Viagem do documento.' },
    { key: 'document_id', type: 'id', label: 'ID do documento (opcional)', example: 'seguro', help: 'Opcional. Se vazio, a chave é o nome do documento.' },
    { key: 'category', type: 'enum', options: 'document_categories', required: true, label: 'Categoria', example: 'voucher', help: 'voucher, bilhete, reserva, seguro, ingresso, orientacao, outro (configurável).' },
    { key: 'file_name', type: 'text', max: 160, required: true, label: 'Nome do documento', example: 'Voucher do transfer Roma', help: 'Nome que o viajante verá.' },
    { key: 'file_url_or_upload_name', type: 'source', required: true, label: 'Arquivo', example: 'voucher-transfer.pdf', help: 'Nome exato do arquivo anexado no upload (PDF/JPG/PNG/WEBP) ou link https.' },
    { key: 'visible_to_traveler', type: 'bool', required: true, label: 'Visível ao viajante', example: 'sim', help: 'sim ou não. "não" deixa o arquivo só para a equipe.' },
    { key: 'stage', type: 'enum', options: 'document_stages', label: 'Etapa', example: 'destino', help: 'antes, ida, destino ou volta.' },
    { key: 'notes', type: 'text', max: 2000, label: 'Observações', example: 'Apresentar impresso.', help: 'Opcional.' },
  ],
  rowKey: (v) => `${v.trip_id}|${documentKey(v)}`,
  describe: (v) => `${v.trip_id} · ${v.file_name ?? ''}`,
  find: (db, v) => db.prepare('SELECT * FROM documents WHERE trip_id = ? AND external_id = ?').get(v.trip_id, documentKey(v)),
  toDb: (v, existing) => ({
    trip_id: v.trip_id ?? existing.trip_id,
    external_id: existing?.external_id ?? documentKey(v),
    ...mapped(DOCUMENT_MAP, v, existing),
  }),
  fromDb: (row) => ({
    trip_id: row.trip_id,
    document_id: row.external_id,
    file_url_or_upload_name: row.source_name,
    ...unmapped(DOCUMENT_MAP, row, { visible_to_traveler: (x) => !!x }),
  }),
  extraChanges: (v, existing, ctx) => {
    const c = fileChanged(v, 'file_url_or_upload_name', existing, ctx);
    return c ? { arquivo: c } : {};
  },
  check(v, ctx, existing) {
    const issues = [];
    tripMustExist(v, ctx, issues);
    checkSource(v, 'file_url_or_upload_name', existing, ctx, DOCUMENT_TYPES, issues);
    return issues;
  },
  apply(db, v, ctx) {
    const existing = ctx.forceExisting || DOCUMENTS.find(db, v);
    const file = storeSource(v, 'file_url_or_upload_name', existing, ctx);
    const result = genericApply(DOCUMENTS, db, v, ctx);
    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(result.id);
    if (file && 'storage_key' in file) {
      const version = existing ? doc.version + 1 : 1;
      db.prepare(
        `UPDATE documents SET storage_key = ?, external_url = ?, mime_type = ?, size_bytes = ?, sha256 = ?, source_name = ?, version = ?, uploaded_by = ?, updated_at = ? WHERE id = ?`,
      ).run(file.storage_key, file.external_url, file.mime_type, file.size_bytes, file.sha256, file.source_name, version, ctx.actorId, ctx.nowIso, doc.id);
      db.prepare(
        `INSERT INTO document_versions (id, document_id, version, storage_key, external_url, file_name, mime_type, size_bytes, sha256, uploaded_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(newId('dv_'), doc.id, version, file.storage_key, file.external_url, file.source_name, file.mime_type, file.size_bytes, file.sha256, ctx.actorId, ctx.nowIso);
      if (existing) {
        audit(db, { actorId: ctx.actorId, entityType: 'document', entityId: doc.id, tripId: doc.trip_id, action: 'replace_file', before: { version: doc.version, file: existing.source_name }, after: { version, file: file.source_name }, source: ctx.source });
      }
      return { ...result, action: result.action === 'unchanged' ? 'update' : result.action, fileReplaced: !!existing };
    } else if (file?.source_name) {
      db.prepare('UPDATE documents SET source_name = ? WHERE id = ?').run(file.source_name, doc.id);
    }
    return result;
  },
};

const TASK_MAP = [
  ['title', 'title'],
  ['description', 'description'],
  ['due_date', 'due_date'],
  ['priority', 'priority'],
  ['source_rule', 'source_rule'],
  ['official_url', 'official_url'],
];
const taskKey = (v) => v.task_id || slug(v.title, 60);

export const TASKS = {
  keyColumns: ['trip_id'],
  map: TASK_MAP,
  sheet: 'TASKS',
  label: 'Tarefas',
  aliases: ['TAREFAS', 'CHECKLIST'],
  kind: 'trip',
  table: 'tasks',
  entityType: 'task',
  idPrefix: 'tsk_',
  columns: [
    { key: 'trip_id', type: 'id', required: true, label: 'Código da viagem', example: 'VG-2026-001', help: 'Viagem da tarefa.' },
    { key: 'task_id', type: 'id', label: 'ID da tarefa (opcional)', example: 'reserva-vaticano', help: 'Opcional. Se vazio, a chave é o título.' },
    { key: 'title', type: 'text', max: 160, required: true, label: 'Tarefa', example: 'Escolher horário do Vaticano', help: 'O que o viajante precisa fazer.' },
    { key: 'description', type: 'text', max: 4000, label: 'Descrição', example: 'Avise a Vagari até a data.', help: 'Orientação.' },
    { key: 'due_date', type: 'date', label: 'Prazo', example: '2026-11-30', help: 'Prazo sugerido.' },
    { key: 'priority', type: 'enum', options: PRIORITIES, label: 'Prioridade', example: 'alta', help: 'alta, media ou baixa. Vazio = media.' },
    { key: 'source_rule', type: 'text', max: 120, label: 'Origem', example: 'Pedido do cliente', help: 'Informativo.' },
    { key: 'official_url', type: 'url', label: 'Link oficial', example: 'https://www.gov.br/…', help: 'Fonte oficial da orientação.' },
  ],
  rowKey: (v) => `${v.trip_id}|${taskKey(v)}`,
  describe: (v) => `${v.trip_id} · ${v.title ?? ''}`,
  find: (db, v) => db.prepare('SELECT * FROM tasks WHERE trip_id = ? AND external_id = ?').get(v.trip_id, taskKey(v)),
  toDb: (v, existing, ctx) => ({
    trip_id: v.trip_id ?? existing.trip_id,
    external_id: existing?.external_id ?? taskKey(v),
    source: existing?.source ?? (ctx.source === 'import' ? 'import' : 'manual'),
    ...mapped(TASK_MAP, v, existing, { priority: 'media' }),
  }),
  fromDb: (row) => ({ trip_id: row.trip_id, task_id: row.external_id, ...unmapped(TASK_MAP, row) }),
  check(v, ctx) {
    const issues = [];
    const trip = tripMustExist(v, ctx, issues);
    if (v.due_date && trip?.end_date && v.due_date > trip.end_date)
      issues.push(warn('due_date', 'Prazo depois do fim da viagem.', 'Confira a data.'));
    return issues;
  },
  apply: (db, v, ctx) => genericApply(TASKS, db, v, ctx),
};

// ---------------------------------------------------------------- biblioteca de conteúdo

const DESTINATION_MAP = [
  ['parent_id', 'parent_id'],
  ['country', 'country'],
  ['region', 'region'],
  ['city', 'city'],
  ['neighborhood', 'neighborhood'],
  ['language', 'language'],
  ['overview', 'overview'],
  ['best_season', 'best_season'],
  ['timezone', 'timezone'],
];

export const DESTINATIONS = {
  keyColumns: ['destination_id'],
  map: DESTINATION_MAP,
  sheet: 'DESTINATIONS',
  label: 'Destinos',
  aliases: ['DESTINOS'],
  kind: 'content',
  table: 'destinations',
  entityType: 'destination',
  naturalId: 'destination_id',
  columns: [
    { key: 'destination_id', type: 'id', required: true, label: 'ID do destino', example: 'roma', help: 'Identificador estável (ex.: italia, roma, roma-trastevere).' },
    { key: 'country', type: 'text', max: 80, required: true, label: 'País', example: 'Itália', help: 'País.' },
    { key: 'region', type: 'text', max: 80, label: 'Região/estado', example: 'Lácio', help: 'Opcional.' },
    { key: 'city', type: 'text', max: 80, label: 'Cidade', example: 'Roma', help: 'Vazio = destino de nível país/região.' },
    { key: 'neighborhood', type: 'text', max: 80, label: 'Bairro', example: 'Trastevere', help: 'Opcional.' },
    { key: 'language', type: 'text', max: 40, label: 'Idioma', example: 'Italiano', help: 'Opcional.' },
    { key: 'overview', type: 'text', max: 2000, label: 'Apresentação', example: 'Capital italiana…', help: 'Texto curto e original.' },
    { key: 'best_season', type: 'text', max: 200, label: 'Melhor época', example: 'Abril a junho; setembro a outubro', help: 'Opcional.' },
    { key: 'timezone', type: 'timezone', label: 'Fuso horário', example: 'Europe/Rome', help: 'Nome IANA. Usado como padrão nas viagens.' },
    { key: 'parent_id', type: 'id', label: 'Destino pai', example: 'italia', help: 'Opcional: destination_id do nível acima (país/região/cidade). Monta a hierarquia.' },
  ],
  rowKey: (v) => v.destination_id,
  describe: (v) => `${v.destination_id} · ${[v.neighborhood, v.city, v.region, v.country].filter(Boolean).join(', ')}`,
  find: (db, v) => db.prepare('SELECT * FROM destinations WHERE id = ?').get(v.destination_id),
  toDb: (v, existing) => mapped(DESTINATION_MAP, v, existing),
  fromDb: (row) => ({ destination_id: row.id, ...unmapped(DESTINATION_MAP, row) }),
  check(v, ctx) {
    const issues = [];
    if (v.parent_id) {
      if (v.parent_id === v.destination_id) issues.push(err('parent_id', 'Um destino não pode ser pai dele mesmo.', 'Use o destino do nível acima.'));
      else if (!ctx.destinationExists(v.parent_id))
        issues.push(err('parent_id', `O destino pai "${v.parent_id}" não existe.`, 'Inclua-o nesta planilha (aba DESTINATIONS) ou cadastre antes.'));
      else if (ctx.wouldCycle?.(v.destination_id, v.parent_id))
        issues.push(err('parent_id', 'Essa ligação cria um ciclo na hierarquia.', 'Confira os destinos pai.'));
    }
    return issues;
  },
  apply: (db, v, ctx) => genericApply(DESTINATIONS, db, v, ctx),
};

const PLACE_MAP = [
  ['destination_id', 'destination_id'],
  ['name', 'name'],
  ['category', 'category'],
  ['short_description', 'short_description'],
  ['address', 'address'],
  ['latitude', 'latitude'],
  ['longitude', 'longitude'],
  ['price_level', 'price_level'],
  ['official_url', 'official_url'],
  ['booking_url', 'booking_url'],
  ['opening_hours', 'opening_hours'],
  ['tags', 'tags', (t) => JSON.stringify(t)],
  ['source_url', 'source_url'],
  ['last_verified_at', 'last_verified_at'],
  ['verification_notes', 'verification_notes'],
];

export const PLACES = {
  keyColumns: ['content_id'],
  map: PLACE_MAP,
  sheet: 'PLACES',
  label: 'Lugares',
  aliases: ['LUGARES'],
  kind: 'content',
  table: 'places',
  entityType: 'place',
  naturalId: 'content_id',
  columns: [
    { key: 'content_id', type: 'id', required: true, label: 'ID do conteúdo', example: 'roma-coliseu', help: 'Identificador estável do lugar.' },
    { key: 'destination_id', type: 'id', required: true, label: 'Destino', example: 'roma', help: 'destination_id da cidade/bairro.' },
    { key: 'name', type: 'text', max: 160, required: true, label: 'Nome', example: 'Coliseu', help: 'Nome do lugar.' },
    { key: 'category', type: 'enum', options: 'place_categories', required: true, label: 'Categoria', example: 'ponto_turistico', help: 'Lista configurável no painel.' },
    { key: 'short_description', type: 'text', max: 350, label: 'Descrição curta', example: 'Anfiteatro romano…', help: 'Texto original, até 350 caracteres.' },
    { key: 'address', type: 'text', max: 300, label: 'Endereço', example: 'Piazza del Colosseo, 1, Roma', help: 'Endereço completo.' },
    { key: 'latitude', type: 'decimal', min: -90, max: 90, label: 'Latitude', example: '41.8902', help: 'Opcional.' },
    { key: 'longitude', type: 'decimal', min: -180, max: 180, label: 'Longitude', example: '12.4922', help: 'Opcional.' },
    { key: 'price_level', type: 'enum', options: PRICE_LEVELS, label: 'Faixa de preço', example: '$$', help: 'Só com fonte confiável: $, $$, $$$ ou $$$$.' },
    { key: 'official_url', type: 'url', label: 'Site oficial', example: 'https://…', help: 'Link oficial.' },
    { key: 'booking_url', type: 'url', label: 'Link de reserva', example: 'https://…', help: 'Link oficial de reserva/ingresso.' },
    { key: 'opening_hours', type: 'text', max: 500, label: 'Horário', example: 'Diariamente, 9h–19h', help: 'Só se verificado em fonte oficial.' },
    { key: 'tags', type: 'tags', label: 'Tags', example: 'história, ao ar livre', help: 'Separadas por vírgula.' },
    { key: 'source_url', type: 'url', label: 'Fonte consultada', example: 'https://…', help: 'URL da fonte usada na pesquisa.' },
    { key: 'last_verified_at', type: 'date', label: 'Verificado em', example: '2026-10-31', help: 'Data da última verificação.' },
    { key: 'status', type: 'enum', options: PLACE_STATUS, label: 'Situação', example: 'pendente', help: 'A importação nunca publica: tudo entra como pendente de revisão. Use "arquivado" para tirar do ar.' },
    { key: 'verification_notes', type: 'text', max: 1000, label: 'Observações de confiança', example: 'Horário não verificado', help: 'Ex.: campos "não verificados".' },
  ],
  rowKey: (v) => v.content_id,
  describe: (v) => `${v.content_id} · ${v.name ?? ''}`,
  find: (db, v) => db.prepare('SELECT * FROM places WHERE id = ?').get(v.content_id),
  toDb(v, existing) {
    const rec = mapped(PLACE_MAP, v, existing, { tags: '[]' });
    const contentChanged = existing && Object.keys(rec).some((k) => !same(rec[k], existing[k]));
    if (v.status === 'archived') rec.status = 'archived';
    else if (!existing) rec.status = 'pending_review';
    else if (contentChanged || existing.status === 'archived') rec.status = 'pending_review';
    else rec.status = existing.status;
    return rec;
  },
  fromDb: (row) => ({ content_id: row.id, status: row.status, ...unmapped(PLACE_MAP, row, { tags: (t) => JSON.parse(t || '[]') }) }),
  check(v, ctx, existing, _db, raw = v) {
    const issues = [];
    if (v.destination_id && !ctx.destinationExists(v.destination_id))
      issues.push(err('destination_id', `O destino "${v.destination_id}" não existe.`, 'Inclua-o na aba DESTINATIONS ou cadastre antes.'));
    if ((v.latitude == null) !== (v.longitude == null) && (v.latitude !== undefined || v.longitude !== undefined))
      issues.push(err('longitude', 'Informe latitude e longitude juntas.', 'Preencha as duas ou nenhuma.'));
    if (raw.status === 'approved')
      issues.push(warn('status', 'A importação não publica itens.', 'O item entra como pendente; aprove no painel depois da revisão.'));
    if (existing?.status === 'approved')
      issues.push(warn(null, 'Item publicado: se o conteúdo mudar, ele volta para revisão e sai do app até ser aprovado de novo.', null));
    if (v.last_verified_at && v.last_verified_at > ctx.today) issues.push(warn('last_verified_at', 'Data de verificação no futuro.', 'Confira a data.'));
    return issues;
  },
  apply: (db, v, ctx) => genericApply(PLACES, db, v, ctx),
};

const MEDIA_MAP = [
  ['alt_text', 'alt_text'],
  ['rights_notes', 'rights_notes'],
];

export const MEDIA = {
  keyColumns: ['content_id', 'display_order'],
  map: MEDIA_MAP,
  sheet: 'MEDIA',
  label: 'Imagens',
  aliases: ['MIDIA', 'IMAGENS', 'FOTOS'],
  kind: 'content',
  table: 'place_media',
  entityType: 'place_media',
  idPrefix: 'med_',
  columns: [
    { key: 'content_id', type: 'id', required: true, label: 'ID do conteúdo', example: 'roma-coliseu', help: 'Lugar ao qual a imagem pertence.' },
    { key: 'image_url_or_upload_name', type: 'source', required: true, label: 'Imagem', example: 'coliseu-1.jpg', help: 'Nome do arquivo anexado (JPG/PNG/WEBP) ou link https.' },
    { key: 'alt_text', type: 'text', max: 250, required: true, label: 'Texto alternativo', example: 'Fachada do Coliseu ao entardecer', help: 'Descrição da imagem para acessibilidade.' },
    { key: 'display_order', type: 'int', min: 1, max: 50, required: true, label: 'Ordem', example: '1', help: 'Posição da imagem (1 = capa). É a chave para substituir a imagem.' },
    { key: 'rights_notes', type: 'text', max: 500, label: 'Direitos de uso', example: 'Foto própria Vagari', help: 'Origem/licença da imagem.' },
  ],
  rowKey: (v) => `${v.content_id}|${v.display_order}`,
  describe: (v) => `${v.content_id} · imagem ${v.display_order}`,
  tripOf: () => null,
  find: (db, v) => db.prepare('SELECT * FROM place_media WHERE place_id = ? AND display_order = ?').get(v.content_id, v.display_order),
  toDb: (v, existing) => ({
    place_id: v.content_id ?? existing.place_id,
    display_order: v.display_order ?? existing.display_order,
    ...mapped(MEDIA_MAP, v, existing),
  }),
  fromDb: (row) => ({ content_id: row.place_id, display_order: row.display_order, image_url_or_upload_name: row.source_name, ...unmapped(MEDIA_MAP, row) }),
  extraChanges: (v, existing, ctx) => {
    const c = fileChanged(v, 'image_url_or_upload_name', existing, ctx);
    return c ? { imagem: c } : {};
  },
  check(v, ctx, existing) {
    const issues = [];
    if (v.content_id && !ctx.placeExists(v.content_id))
      issues.push(err('content_id', `O lugar "${v.content_id}" não existe.`, 'Inclua-o na aba PLACES desta planilha ou cadastre antes.'));
    checkSource(v, 'image_url_or_upload_name', existing, ctx, IMAGE_TYPES, issues);
    if (v.image_url_or_upload_name && !v.rights_notes && !existing?.rights_notes)
      issues.push(warn('rights_notes', 'Sem informação de direitos de uso da imagem.', 'Registre a origem/licença antes de publicar.'));
    return issues;
  },
  apply(db, v, ctx) {
    const existing = ctx.forceExisting || MEDIA.find(db, v);
    const file = storeSource(v, 'image_url_or_upload_name', existing, ctx);
    const result = genericApply(MEDIA, db, v, ctx);
    if (file) {
      if (!('storage_key' in file)) {
        db.prepare('UPDATE place_media SET source_name = ? WHERE id = ?').run(file.source_name, result.id);
        return result;
      }
      const prev = db.prepare('SELECT storage_key FROM place_media WHERE id = ?').get(result.id);
      db.prepare('UPDATE place_media SET media_url = ?, storage_key = ?, source_name = ?, sha256 = ?, updated_at = ? WHERE id = ?').run(
        file.external_url,
        file.storage_key,
        file.source_name,
        file.sha256,
        ctx.nowIso,
        result.id,
      );
      if (prev.storage_key && prev.storage_key !== file.storage_key) ctx.removedFiles.push(prev.storage_key);
      return { ...result, action: result.action === 'unchanged' ? 'update' : result.action };
    }
    return result;
  },
};

export const TRIP_SHEETS = [TRIPS, TRAVELERS, FLIGHTS, ACCOMMODATIONS, ITINERARY, DOCUMENTS, TASKS];
export const CONTENT_SHEETS = [DESTINATIONS, PLACES, MEDIA];
export const ALL_ENTITIES = [...TRIP_SHEETS, ...CONTENT_SHEETS];
export const sheetsFor = (kind) => (kind === 'content' ? CONTENT_SHEETS : TRIP_SHEETS);
