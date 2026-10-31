/**
 * Simulação do servidor para a prévia do painel. Mesmas rotas/respostas da API real,
 * com dados FICTÍCIOS em memória (somem ao recarregar a página).
 */
import { buildTrips } from '@shared/demo.js';
import { DESTINATIONS, PLACES, destinationName } from '@shared/library.js';

const DAY = 86_400_000;
const iso = (d) => new Date(d).toISOString().slice(0, 10);
const today = iso(Date.now());
const addDays = (date, n) => iso(Date.parse(date + 'T12:00:00Z') + n * DAY);
const nowIso = () => new Date().toISOString();
let seq = 1000;
const id = (p) => `${p}_${++seq}`;
const wait = (v) => new Promise((r) => setTimeout(() => r(structuredClone(v)), 160));
const fail = (message, status = 422, issues) => Promise.reject(Object.assign(new Error(message), { status, issues }));

const SETTINGS = {
  agency_name: 'Vagari',
  whatsapp_number: '5511999990000',
  whatsapp_message: 'Oi, Vagari! Aqui é {nome}, da viagem "{viagem}" ({codigo}) pra {destino}. Preciso de uma ajuda com: ',
  support_24h: false,
  support_hours_text: 'Seg. a sex., 9h às 18h',
  home_country: 'Brasil',
  invite_expiry_days: 14,
  reminder_days_before: 3,
  itinerary_categories: [
    { key: 'transfer', label: 'Transfer' }, { key: 'passeio', label: 'Passeio' }, { key: 'experiencia', label: 'Experiência' }, { key: 'restaurante', label: 'Restaurante' },
    { key: 'ingresso', label: 'Ingresso / atração' }, { key: 'transporte', label: 'Trem / ônibus / carro' }, { key: 'livre', label: 'Tempo livre' }, { key: 'outro', label: 'Outro' },
  ],
  document_categories: [
    { key: 'voucher', label: 'Voucher' }, { key: 'bilhete', label: 'Bilhete aéreo' }, { key: 'reserva', label: 'Reserva / hospedagem' }, { key: 'seguro', label: 'Seguro viagem' },
    { key: 'ingresso', label: 'Ingresso' }, { key: 'orientacao', label: 'Orientações' }, { key: 'outro', label: 'Outro' },
  ],
  place_categories: [
    { key: 'ponto_turistico', label: 'Pontos turísticos' }, { key: 'museu_cultura', label: 'Museus e cultura' }, { key: 'restaurante', label: 'Restaurantes' }, { key: 'cafe', label: 'Cafés' },
    { key: 'bar', label: 'Bares' }, { key: 'experiencia', label: 'Experiências' }, { key: 'compras', label: 'Compras' }, { key: 'servicos', label: 'Serviços úteis' },
  ],
  trip_types: [{ key: 'lazer', label: 'Lazer' }, { key: 'lua_de_mel', label: 'Lua de mel' }, { key: 'familia', label: 'Família' }, { key: 'aventura', label: 'Aventura' }, { key: 'gastronomia', label: 'Gastronomia' }],
};

function seedTrips() {
  const [italy, rio] = buildTrips(today, 'before');
  const conv = (t, extra) => ({
    id: t.id,
    name: t.name,
    destination_id: t.destination_id,
    start_date: t.start_date,
    end_date: t.end_date,
    timezone: t.timezone,
    status: 'published',
    trip_type: 'lazer',
    general_notes: t.general_notes || null,
    cover_image_url: null,
    travelers: [],
    flights: t.flights.map((f) => ({ ...f, trip_id: t.id })),
    accommodations: t.stays.map((s) => ({ ...s, trip_id: t.id, external_id: s.id })),
    itinerary: t.items.map((i) => ({ ...i, trip_id: t.id, external_id: i.id })),
    documents: t.documents.map((d) => ({ ...d, trip_id: t.id, visible_to_traveler: 1, source_name: `${d.id}.pdf`, updated_at: nowIso() })),
    tasks: t.tasks.map((k, i) => ({ ...k, trip_id: t.id, source: i < 3 || i > 4 ? 'rule' : 'manual', active: 1, completions: i === 0 ? 2 : i === 1 ? 1 : 0 })),
    announcements: t.announcements.map((a) => ({ ...a, trip_id: t.id })),
    highlights: t.highlights.map((h) => ({ ...h, name: PLACES.find((p) => p.id === h.place_id)?.name, status: 'approved' })),
    ...extra,
  });
  const it = conv(italy, {
    travelers: [
      { id: 'tt1', user_id: 'u1', email: 'ana@exemplo.com', name: 'Ana Lima', traveler_role: 'titular', invitation_status: 'accepted', last_login_at: nowIso(), nationality: 'Brasil', phone: '5511988887777' },
      { id: 'tt2', user_id: 'u2', email: 'bruno@exemplo.com', name: 'Bruno Lima', traveler_role: 'acompanhante', invitation_status: 'sent', last_login_at: null, nationality: 'Brasil', phone: null },
    ],
  });
  const r = conv(rio, {
    status: 'draft',
    travelers: [{ id: 'tt3', user_id: 'u1', email: 'ana@exemplo.com', name: 'Ana Lima', traveler_role: 'titular', invitation_status: 'not_sent', last_login_at: nowIso() }],
  });
  const simple = (tid, name, dest, start, len, status, travelers, extra = {}) => ({
    id: tid, name, destination_id: dest, start_date: addDays(today, start), end_date: addDays(today, start + len), timezone: DESTINATIONS.find((d) => d.id === dest)?.timezone, status, trip_type: 'lazer', general_notes: null,
    travelers, flights: [], accommodations: [], itinerary: [], documents: [], tasks: [], announcements: [], highlights: [], ...extra,
  });
  return [
    it,
    r,
    simple('VG-2026-022', 'Lua de mel em Santorini', 'santorini', 55, 8, 'draft', [{ id: 'tt4', email: 'carla@exemplo.com', name: 'Carla Mendes', traveler_role: 'titular', invitation_status: 'not_sent' }, { id: 'tt5', email: 'diego@exemplo.com', name: 'Diego Mendes', traveler_role: 'acompanhante', invitation_status: 'not_sent' }], { trip_type: 'lua_de_mel' }),
    simple('VG-2026-009', 'Disney em família', 'orlando', 12, 9, 'published', [{ id: 'tt6', email: 'eduardo@exemplo.com', name: 'Eduardo Rocha', traveler_role: 'titular', invitation_status: 'accepted', last_login_at: nowIso() }, { id: 'tt7', email: 'lia@exemplo.com', name: 'Lia Rocha', traveler_role: 'crianca', invitation_status: 'not_sent' }], {
      trip_type: 'familia',
      flights: [{ id: 'fx1', segment_order: 1, airline: 'LATAM', flight_number: 'LA 8190', departure_airport: 'GRU', departure_at: `${addDays(today, 12)}T23:55`, arrival_airport: 'MCO', arrival_at: `${addDays(today, 13)}T07:10`, booking_reference: 'ZX81QP' }],
      accommodations: [{ id: 'ax1', name: 'Resort Lago Azul', city_id: 'orlando', checkin_at: `${addDays(today, 13)}T15:00`, checkout_at: `${addDays(today, 21)}T11:00`, address: 'Lake Buena Vista, FL' }],
    }),
    simple('VG-2026-027', 'Machu Picchu raiz', 'machu-picchu', 90, 7, 'draft', [], { trip_type: 'aventura' }),
    simple('VG-2026-003', 'Aurora boreal na Islândia', 'reykjavik', -40, 6, 'archived', [{ id: 'tt8', email: 'fabio@exemplo.com', name: 'Fábio Teixeira', traveler_role: 'titular', invitation_status: 'accepted', last_login_at: nowIso() }]),
  ];
}

const PENDING_DEST = new Set(['toquio', 'aruba', 'lisboa']);
function seedPlaces() {
  return PLACES.map((p, i) => ({
    id: p.id, destination_id: p.destination, name: p.name, category: p.category, short_description: p.description, address: p.address, latitude: p.lat, longitude: p.lng,
    official_url: p.url || null, tags: p.tags || [], source_url: null, last_verified_at: today,
    verification_notes: 'Montado sem acesso à internet: conferir endereço, coordenadas e site oficial.',
    status: PENDING_DEST.has(p.destination) ? 'pending_review' : i % 17 === 5 ? 'archived' : 'approved',
    updated_at: nowIso(),
  }));
}

const RULES = [
  { title: 'Confira nomes e dados das reservas', days_before: null, priority: 'alta', conditions: {}, description: 'Nome nas reservas igual ao do documento.' },
  { title: 'Verifique o passaporte e os requisitos de entrada', days_before: 105, priority: 'alta', conditions: { international: true }, official_url: 'https://www.gov.br/pf/pt-br/assuntos/passaporte' },
  { title: 'Verifique visto, vacinas e seguro viagem', days_before: 75, priority: 'alta', conditions: { international: true }, official_url: 'https://www.gov.br/mre/pt-br/assuntos/portal-consular' },
  { title: 'Autorização de viagem para menores', days_before: 60, priority: 'alta', conditions: { has_children: true } },
  { title: 'Revise as reservas e planeje as experiências', days_before: 30, priority: 'media', conditions: {} },
  { title: 'Monte a mala e separe os documentos', days_before: 7, priority: 'media', conditions: {} },
  { title: 'Confira check-in, aeroporto e transporte', days_before: 2, priority: 'alta', conditions: {} },
].map((r) => ({ id: id('rul'), description: r.description || '', official_url: r.official_url || null, active: true, ...r }));

export function createAdminMock() {
  const db = {
    trips: seedTrips(),
    places: seedPlaces(),
    destinations: DESTINATIONS.map((d) => ({ id: d.id, parent_id: d.parent || null, country: d.country, region: d.region || null, city: d.city, overview: d.overview || '', best_season: d.best_season || '', timezone: d.timezone, art: d.art })),
    rules: RULES,
    settings: structuredClone(SETTINGS),
    users: [
      { id: 'adm1', email: 'marina@vagari.com.br', name: 'Marina Costa', role: 'admin', last_login_at: nowIso() },
      { id: 'adm2', email: 'rafael@vagari.com.br', name: 'Rafael Nunes', role: 'admin', last_login_at: nowIso() },
      { id: 'ed1', email: 'pedro@vagari.com.br', name: 'Pedro Alves', role: 'editor', last_login_at: null },
    ],
    audit: [],
    imports: [
      { id: 'imp_1', kind: 'trip', status: 'completed', file_names: ['italia-vg-2026-014.xlsx'], created_at: new Date(Date.now() - 3 * DAY).toISOString(), completed_at: new Date(Date.now() - 3 * DAY + 240000).toISOString(), error_count: 2, summary: { sheets: [{ sheet: 'ITINERARY', label: 'Roteiro', create: 11 }] } },
      { id: 'imp_2', kind: 'content', status: 'completed', file_names: ['biblioteca-inicial.xlsx'], created_at: new Date(Date.now() - 5 * DAY).toISOString(), completed_at: new Date(Date.now() - 5 * DAY + 600000).toISOString(), error_count: 0 },
    ],
    privacy: [{ id: 'prv1', email: 'fabio@exemplo.com', name: 'Fábio Teixeira', kind: 'deletion', message: 'Podem apagar meus dados depois da viagem.', status: 'open', created_at: nowIso() }],
    logged: false,
  };
  const log = (entity_type, entity_id, action, after, trip_id = null, before = null) =>
    db.audit.unshift({ id: id('aud'), actor_email: 'marina@vagari.com.br', actor_name: 'Marina Costa', entity_type, entity_id, trip_id, action, before, after, source: 'panel', created_at: nowIso() });
  log('trip', 'VG-2026-014', 'update', { general_notes: 'Na Itália a tomada é tipo L…' }, 'VG-2026-014', { general_notes: null });
  log('document', 'd2', 'replace_file', { version: 2 }, 'VG-2026-014', { version: 1 });
  log('import_job', 'imp_1', 'confirm', { trips: ['VG-2026-014'] });

  const getTrip = (tid) => db.trips.find((t) => t.id === tid) || null;
  const summary = (t) => {
    const missing = [];
    if (!t.travelers.length) missing.push('viajantes');
    if (!t.flights.length) missing.push('voos');
    if (!t.accommodations.length) missing.push('hospedagem');
    if (!t.documents.filter((d) => d.visible_to_traveler).length) missing.push('documentos visíveis');
    return {
      travelers: t.travelers.length, accepted: t.travelers.filter((x) => x.invitation_status === 'accepted').length, flights: t.flights.length, accommodations: t.accommodations.length,
      itinerary: t.itinerary.length, documents: t.documents.filter((d) => d.visible_to_traveler).length, essential_complete: !missing.length, missing,
    };
  };
  const destName = (did) => destinationName(DESTINATIONS.find((d) => d.id === did));
  const tripRow = (t) => ({ ...t, city: destName(t.destination_id), country: DESTINATIONS.find((d) => d.id === t.destination_id)?.country, summary: summary(t), travelers_preview: t.travelers.map((x) => x.name) });
  const need = (cells, keys) => {
    const issues = keys.filter((k) => !String(cells[k] ?? '').trim()).map((k) => ({ severity: 'error', column: k, message: 'Campo obrigatório vazio.' }));
    return issues.length ? fail('Confira os campos destacados.', 422, issues) : null;
  };

  return {
    demo: true,
    async requestCode() { return wait({ ok: true }); },
    async verifyCode() { db.logged = true; return wait({ user: db.users[0] }); },
    async me() { return wait({ user: db.users[0] }); },
    async logout() { return wait({ ok: true }); },

    async trips({ status, q } = {}) {
      let list = db.trips;
      if (status) list = list.filter((t) => t.status === status);
      if (q) { const n = q.toLowerCase(); list = list.filter((t) => (t.id + t.name + t.travelers.map((x) => x.name + x.email).join()).toLowerCase().includes(n)); }
      return wait({ trips: list.map(tripRow).sort((a, b) => a.start_date.localeCompare(b.start_date)) });
    },
    async trip(tid) {
      const t = getTrip(tid);
      if (!t) return fail('Viagem não encontrada.', 404);
      return wait({ trip: tripRow(t), summary: summary(t), destination: db.destinations.find((d) => d.id === t.destination_id), ...t });
    },
    async createTrip(cells) {
      const err = need(cells, ['trip_id', 'trip_name', 'destination_id', 'start_date', 'end_date']);
      if (err) return err;
      if (getTrip(cells.trip_id)) return fail('Já existe uma viagem com esse código.', 422, [{ severity: 'error', column: 'trip_id', message: 'Código já usado.' }]);
      if (cells.end_date < cells.start_date) return fail('Datas inválidas.', 422, [{ severity: 'error', column: 'end_date', message: 'A data de fim é anterior à de início.' }]);
      const t = { id: cells.trip_id, name: cells.trip_name, destination_id: cells.destination_id, start_date: cells.start_date, end_date: cells.end_date, timezone: cells.timezone || DESTINATIONS.find((d) => d.id === cells.destination_id)?.timezone, status: 'draft', trip_type: cells.trip_type || null, general_notes: cells.general_notes || null, travelers: [], flights: [], accommodations: [], itinerary: [], documents: [], tasks: [], announcements: [], highlights: [] };
      db.trips.push(t);
      log('trip', t.id, 'create', { name: t.name }, t.id);
      return wait({ trip: tripRow(t), warnings: [] });
    },
    async updateTrip(tid, cells) {
      const t = getTrip(tid);
      const before = {};
      const map = { trip_name: 'name', status: 'status', start_date: 'start_date', end_date: 'end_date', general_notes: 'general_notes', trip_type: 'trip_type', destination_id: 'destination_id', timezone: 'timezone' };
      for (const [k, v] of Object.entries(cells)) if (map[k]) { before[map[k]] = t[map[k]]; t[map[k]] = v; }
      log('trip', tid, 'update', Object.fromEntries(Object.keys(before).map((k) => [k, t[k]])), tid, before);
      return wait({ trip: tripRow(t), warnings: [] });
    },
    async addTraveler(tid, cells) {
      const err = need(cells, ['traveler_email', 'traveler_name']);
      if (err) return err;
      const t = getTrip(tid);
      if (t.travelers.some((x) => x.email === cells.traveler_email.toLowerCase())) return fail('Esse e-mail já está nesta viagem.', 422, [{ severity: 'error', column: 'traveler_email', message: 'Já associado.' }]);
      const tt = { id: id('tt'), email: cells.traveler_email.toLowerCase(), name: cells.traveler_name, traveler_role: cells.role || 'acompanhante', invitation_status: 'not_sent', phone: cells.phone_optional || null, nationality: cells.nationality || null };
      t.travelers.push(tt);
      log('trip_traveler', tt.id, 'create', { email: tt.email }, tid);
      return wait({ traveler: tt });
    },
    async updateTraveler(tid, ttId, cells) {
      const tt = getTrip(tid).travelers.find((x) => x.id === ttId);
      Object.assign(tt, { name: cells.traveler_name ?? tt.name, traveler_role: cells.role ?? tt.traveler_role });
      return wait({ traveler: tt });
    },
    async removeTraveler(tid, ttId) {
      const t = getTrip(tid);
      t.travelers = t.travelers.filter((x) => x.id !== ttId);
      log('trip_traveler', ttId, 'delete', null, tid);
      return wait({ ok: true });
    },
    async invite(tid, ttId) {
      const t = getTrip(tid);
      if (t.status !== 'published') return fail('Publique a viagem antes de convidar os viajantes.', 409);
      const tt = t.travelers.find((x) => x.id === ttId);
      if (tt.invitation_status !== 'accepted') tt.invitation_status = 'sent';
      log('trip_traveler', ttId, 'invite', { email: tt.email }, tid);
      return wait({ invite_url: `https://app.vagari.com.br/convite/${Math.random().toString(36).slice(2, 14)}`, expires_at: addDays(today, 14), emailed: true });
    },
    async saveItem(tid, kind, itemId, cells) {
      const t = getTrip(tid);
      const req = { flights: ['segment_order', 'airline', 'flight_number', 'departure_airport', 'departure_datetime', 'arrival_airport', 'arrival_datetime'], accommodations: ['property_name', 'checkin_datetime', 'checkout_datetime'], itinerary: ['date', 'title', 'category'], tasks: ['title'] }[kind];
      const err = itemId ? null : need(cells, req);
      if (err) return err;
      const norm = {
        flights: (c) => ({ segment_order: Number(c.segment_order), airline: c.airline, flight_number: c.flight_number, departure_airport: c.departure_airport?.toUpperCase(), departure_at: c.departure_datetime?.replace(' ', 'T'), arrival_airport: c.arrival_airport?.toUpperCase(), arrival_at: c.arrival_datetime?.replace(' ', 'T'), booking_reference: c.booking_reference, notes: c.notes }),
        accommodations: (c) => ({ name: c.property_name, city_id: c.city_id, checkin_at: c.checkin_datetime?.replace(' ', 'T'), checkout_at: c.checkout_datetime?.replace(' ', 'T'), address: c.address, confirmation_code: c.confirmation_code, notes: c.notes }),
        itinerary: (c) => ({ date: c.date, start_time: c.start_time, end_time: c.end_time, title: c.title, category: c.category, address: c.address, description: c.description, booking_status: c.booking_status, city_id: c.city_id, confirmation_code: c.confirmation_code }),
        tasks: (c) => ({ title: c.title, description: c.description, due_date: c.due_date, priority: c.priority || 'media', source: 'manual', active: 1, completions: 0 }),
      }[kind](cells);
      const clean = Object.fromEntries(Object.entries(norm).filter(([, v]) => v !== undefined && v !== ''));
      let item;
      if (itemId) {
        item = t[kind].find((x) => x.id === itemId);
        const before = Object.fromEntries(Object.keys(clean).map((k) => [k, item[k]]));
        Object.assign(item, clean);
        log(kind.slice(0, -1), itemId, 'update', clean, tid, before);
      } else {
        item = { id: id(kind.slice(0, 3)), trip_id: tid, ...clean };
        t[kind].push(item);
        log(kind.slice(0, -1), item.id, 'create', clean, tid);
      }
      return wait({ item, warnings: [] });
    },
    async deleteItem(tid, kind, itemId) {
      const t = getTrip(tid);
      t[kind] = t[kind].filter((x) => x.id !== itemId);
      log(kind.slice(0, -1), itemId, 'delete', null, tid);
      return wait({ ok: true });
    },
    async uploadDocument(tid, form) {
      const t = getTrip(tid);
      const file = form.get('file');
      if (!file || !file.name) return fail('Escolha um arquivo.', 422, [{ severity: 'error', column: 'file', message: 'Escolha um arquivo PDF ou imagem.' }]);
      const doc = { id: id('doc'), trip_id: tid, category: form.get('category'), title: form.get('file_name') || file.name.replace(/\.[^.]+$/, ''), stage: form.get('stage'), visible_to_traveler: form.get('visible_to_traveler') === 'sim' ? 1 : 0, version: 1, size_bytes: file.size, source_name: file.name, mime_type: file.type, notes: form.get('notes'), updated_at: nowIso() };
      t.documents.push(doc);
      log('document', doc.id, 'create', { title: doc.title }, tid);
      return wait({ document: doc });
    },
    async updateDocument(tid, docId, cells) {
      const d = getTrip(tid).documents.find((x) => x.id === docId);
      const before = { visible_to_traveler: d.visible_to_traveler, title: d.title, category: d.category };
      if (cells.visible_to_traveler !== undefined) d.visible_to_traveler = cells.visible_to_traveler ? 1 : 0;
      if (cells.file_name) d.title = cells.file_name;
      if (cells.category) d.category = cells.category;
      if (cells.stage) d.stage = cells.stage;
      log('document', docId, 'update', { visible_to_traveler: d.visible_to_traveler, title: d.title, category: d.category }, tid, before);
      return wait({ document: d });
    },
    async replaceDocument(tid, docId, form) {
      const d = getTrip(tid).documents.find((x) => x.id === docId);
      d.version += 1;
      d.source_name = form.get('file')?.name || d.source_name;
      d.updated_at = nowIso();
      log('document', docId, 'replace_file', { version: d.version }, tid, { version: d.version - 1 });
      return wait({ document: d });
    },
    async deleteDocument(tid, docId) {
      const t = getTrip(tid);
      t.documents = t.documents.filter((x) => x.id !== docId);
      log('document', docId, 'delete', null, tid);
      return wait({ ok: true });
    },
    async announce({ trip_ids, title, body, essential }) {
      if (!trip_ids?.length) return fail('Escolha ao menos uma viagem.');
      if (!title?.trim() || !body?.trim()) return fail('Preencha título e mensagem.');
      for (const tid of trip_ids) {
        const a = { id: id('ann'), trip_id: tid, title, body, essential: essential ? 1 : 0, created_at: nowIso() };
        getTrip(tid).announcements.unshift(a);
        log('announcement', a.id, 'create', { title, essential }, tid);
      }
      return wait({ announcement_ids: trip_ids, notified: trip_ids.reduce((s, tid) => s + getTrip(tid).travelers.length, 0) });
    },
    async setHighlight(tid, placeId, note) {
      const t = getTrip(tid);
      const p = db.places.find((x) => x.id === placeId);
      t.highlights = t.highlights.filter((h) => h.place_id !== placeId).concat({ place_id: placeId, note, name: p.name, status: p.status });
      log('trip_place', `${tid}:${placeId}`, 'upsert', { note }, tid);
      return wait({ ok: true, warning: p.status !== 'approved' ? 'O lugar ainda não está aprovado: só aparecerá depois da aprovação.' : null });
    },
    async removeHighlight(tid, placeId) {
      const t = getTrip(tid);
      t.highlights = t.highlights.filter((h) => h.place_id !== placeId);
      return wait({ ok: true });
    },

    async destinations() {
      return wait({ destinations: db.destinations.map((d) => ({ ...d, name: destinationName(d), places: db.places.filter((p) => p.destination_id === d.id).length, approved: db.places.filter((p) => p.destination_id === d.id && p.status === 'approved').length })) });
    },
    async saveDestination(did, cells) {
      if (!did) {
        const err = need(cells, ['destination_id', 'country']);
        if (err) return err;
        db.destinations.push({ id: cells.destination_id, country: cells.country, region: cells.region, city: cells.city, parent_id: cells.parent_id || null, timezone: cells.timezone, overview: cells.overview, best_season: cells.best_season });
        log('destination', cells.destination_id, 'create', cells);
      } else {
        Object.assign(db.destinations.find((d) => d.id === did), cells);
        log('destination', did, 'update', cells);
      }
      return wait({ ok: true });
    },
    async places({ status, destination_id, q } = {}) {
      let list = db.places;
      if (status) list = list.filter((p) => p.status === status);
      if (destination_id) list = list.filter((p) => p.destination_id === destination_id);
      if (q) list = list.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
      const counts = db.places.reduce((m, p) => ((m[p.status] = (m[p.status] || 0) + 1), m), {});
      return wait({ places: list, counts });
    },
    async savePlace(pid, cells) {
      if (!pid) {
        const err = need(cells, ['content_id', 'destination_id', 'name', 'category']);
        if (err) return err;
        const p = { id: cells.content_id, destination_id: cells.destination_id, name: cells.name, category: cells.category, short_description: cells.short_description, address: cells.address, tags: [], status: 'pending_review', updated_at: nowIso() };
        db.places.unshift(p);
        log('place', p.id, 'create', { name: p.name });
        return wait({ place: p });
      }
      const p = db.places.find((x) => x.id === pid);
      const wasApproved = p.status === 'approved';
      Object.assign(p, { name: cells.name ?? p.name, short_description: cells.short_description ?? p.short_description, address: cells.address ?? p.address, category: cells.category ?? p.category, official_url: cells.official_url ?? p.official_url, updated_at: nowIso() });
      if (wasApproved) p.status = 'pending_review';
      log('place', pid, 'update', cells);
      return wait({ place: p, warnings: wasApproved ? [{ severity: 'warning', message: 'O lugar voltou para revisão e saiu do app até ser aprovado de novo.' }] : [] });
    },
    async reviewPlaces(ids, action) {
      const target = { approve: 'approved', reject: 'pending_review', archive: 'archived' }[action];
      const changed = [];
      const blocked = [];
      for (const pid of ids) {
        const p = db.places.find((x) => x.id === pid);
        if (target === 'approved' && !p.address) { blocked.push({ id: pid, reason: 'Sem endereço.' }); continue; }
        p.status = target;
        changed.push(pid);
        log('place', pid, `review_${action}`, { status: target });
      }
      return wait({ changed, blocked });
    },
    async researchPrompt({ city, country, destination_id }) {
      const cols = 'content_id | destination_id | name | category | short_description | address | latitude | longitude | price_level | official_url | booking_url | opening_hours | tags | source_url | last_verified_at | status | verification_notes';
      const cats = db.settings.place_categories.map((c) => `${c.key} (${c.label})`).join(', ');
      return wait({
        prompt: `Atue como pesquisador e editor de conteúdo de destinos para a Vagari, uma agência de experiências.\n\nPesquise a cidade ${city || '[CIDADE]'}, no país ${country || '[PAÍS]'}, e produza uma base de lugares úteis e experiências para viajantes.\n\nOrganize nas categorias (use exatamente a chave): ${cats}.\nPriorize qualidade, relevância para visitantes e diversidade de orçamento.\n\nPara cada item, retorne: nome, categoria, descrição ORIGINAL de até 350 caracteres, endereço, coordenadas quando disponíveis, faixa de preço ($ a $$$$) somente se houver fonte confiável, horário de funcionamento somente se verificado, site oficial, link de reserva oficial quando existir, URL da fonte consultada, data da verificação e observações de confiança.\n\nRegras:\n- Não invente dados. Se um campo não puder ser confirmado, deixe em branco e escreva em verification_notes qual campo está "não verificado".\n- Não copie textos promocionais extensos.\n- Evite duplicatas e lugares fechados permanentemente.\n- Marque todo resultado como PENDENTE DE REVISÃO HUMANA (status = pendente).\n\nFormato de entrega: tabela (ou CSV separado por ponto e vírgula) com EXATAMENTE estas colunas, nesta ordem:\n${cols}\n\n- destination_id: ${destination_id || '<destination_id da cidade>'}\n- last_verified_at: ${today}\n- status: pendente`,
      });
    },

    async imports() { return wait({ imports: db.imports }); },
    async previewImport(form) {
      const kind = form.get('kind');
      const clean = form.get('demo_clean') === '1';
      const files = form.getAll('spreadsheets').map((f) => f.name);
      const rows = (n, base) => Array.from({ length: n }, (_, i) => ({ row: i + 2, label: `${base} ${i + 1}`, action: 'create', changes: {}, issues: [] }));
      const preview = kind === 'content'
        ? { fileIssues: [], sheets: [
            { sheet: 'DESTINATIONS', label: 'Destinos', counts: { create: 1, update: 1, unchanged: 0, error: 0 }, rows: [{ row: 2, label: 'cartagena · Cartagena, Colômbia', action: 'create', changes: {}, issues: [] }, { row: 3, label: 'roma · Roma', action: 'update', changes: { best_season: { from: 'Abril a junho', to: 'Abril a junho; setembro a outubro' } }, issues: [] }] },
            { sheet: 'PLACES', label: 'Lugares', counts: { create: 6, update: 1, unchanged: 0, error: clean ? 0 : 1 }, rows: [
              ...rows(5, 'cartagena · lugar').map((r) => ({ ...r, issues: [] })),
              { row: 7, label: 'roma-coliseu · Coliseu', action: 'update', changes: { short_description: { from: 'O anfiteatro mais famoso do mundo…', to: 'O anfiteatro mais famoso do mundo. Ingresso com horário marcado.' } }, issues: [{ severity: 'warning', column: null, message: 'Item publicado: se o conteúdo mudar, ele volta para revisão e sai do app até ser aprovado de novo.' }] },
              clean ? { row: 8, label: 'cartagena-muralhas · Muralhas', action: 'create', changes: {}, issues: [] } : { row: 8, label: 'cartagena-muralhas · Muralhas', action: 'error', changes: {}, issues: [{ severity: 'error', column: 'latitude', value: '10,42.3', message: 'Número inválido: "10,42.3".', hint: 'Use um número entre -90 e 90 (ex.: 41.9028 ou 41,9028).' }] },
            ] },
          ], errorCount: clean ? 0 : 1, warningCount: 1 }
        : { fileIssues: [], sheets: [
            { sheet: 'TRIPS', label: 'Viagens', counts: { create: 1, update: 0, unchanged: 0, error: 0 }, rows: [{ row: 2, label: 'VG-2026-040 · Paris e Londres', action: 'create', changes: {}, issues: [] }] },
            { sheet: 'TRAVELERS', label: 'Viajantes', counts: { create: 2, update: 0, unchanged: 0, error: clean ? 0 : 1 }, rows: [
              { row: 2, label: 'VG-2026-040 · gabi@exemplo.com', action: 'create', changes: {}, issues: [] },
              clean ? { row: 3, label: 'VG-2026-040 · hugo@exemplo.com', action: 'create', changes: {}, issues: [] } : { row: 3, label: 'VG-2026-040 · hugo-exemplo.com', action: 'error', changes: {}, issues: [{ severity: 'error', column: 'traveler_email', value: 'hugo-exemplo.com', message: 'E-mail inválido: "hugo-exemplo.com".', hint: 'Confira se há espaços, falta de "@" ou de domínio (ex.: nome@empresa.com).' }] },
            ] },
            { sheet: 'FLIGHTS', label: 'Voos', counts: { create: 2, update: 1, unchanged: 0, error: 0 }, rows: [
              { row: 2, label: 'VG-2026-040 · trecho 1 · AF 455', action: 'create', changes: {}, issues: [] },
              { row: 3, label: 'VG-2026-040 · trecho 2 · BA 304', action: 'create', changes: {}, issues: [{ severity: 'warning', column: 'arrival_datetime', message: 'Chegada antes da partida (em hora local).', hint: 'Só é normal em voos que cruzam fusos para o oeste. Confira as datas.' }] },
              { row: 4, label: 'VG-2026-014 · trecho 1 · AZ 675', action: 'update', changes: { departure_datetime: { from: '2026-12-08T22:40', to: '2026-12-08T23:10' } }, issues: [] },
            ] },
            { sheet: 'ACCOMMODATIONS', label: 'Hospedagens', counts: { create: 2, update: 0, unchanged: 1, error: 0 }, rows: [
              { row: 2, label: 'VG-2026-040 · Hôtel Rive Gauche', action: 'create', changes: {}, issues: [] },
              { row: 3, label: 'VG-2026-040 · Hotel Thames', action: 'create', changes: {}, issues: [{ severity: 'warning', column: 'property_name', message: 'Possível duplicidade: "Hotel Thames" já está cadastrada com check-in 2027-03-14T15:00.', hint: 'Se for a mesma hospedagem, preencha accommodation_id = hotel_thames.2027-03-14 para atualizar em vez de criar outra.' }] },
              { row: 4, label: 'VG-2026-014 · Hotel Fontana Centro', action: 'unchanged', changes: {}, issues: [] },
            ] },
            { sheet: 'DOCUMENTS', label: 'Documentos', counts: { create: 2, update: 0, unchanged: 0, error: clean ? 0 : 1 }, rows: [
              { row: 2, label: 'VG-2026-040 · Bilhetes Air France', action: 'create', changes: {}, issues: [] },
              clean ? { row: 3, label: 'VG-2026-040 · Seguro viagem', action: 'create', changes: {}, issues: [] } : { row: 3, label: 'VG-2026-040 · Seguro viagem', action: 'error', changes: {}, issues: [{ severity: 'error', column: 'file_url_or_upload_name', value: 'seguro-gabi.pdf', message: 'O arquivo "seguro-gabi.pdf" não foi enviado junto com a planilha.', hint: 'Anexe o arquivo com exatamente esse nome no upload, ou use um link https.' }] },
            ] },
          ], errorCount: clean ? 0 : 2, warningCount: 2 };
      const job = { id: id('imp'), kind, status: 'preview', file_names: files.length ? files : ['planilha.xlsx'], created_at: nowIso(), preview, error_count: preview.errorCount, warning_count: preview.warningCount };
      db.imports.unshift(job);
      return wait({ import: job });
    },
    async confirmImport(jid, notify) {
      const job = db.imports.find((j) => j.id === jid);
      if (job.preview.errorCount) return fail('Corrija os erros antes de confirmar.', 409);
      job.status = 'completed';
      job.completed_at = nowIso();
      job.summary = { sheets: job.preview.sheets.map((s) => ({ sheet: s.sheet, label: s.label, ...s.counts })), notified: notify ? 2 : 0 };
      log('import_job', jid, 'confirm', job.summary);
      return wait({ import: job });
    },
    async cancelImport(jid) {
      const job = db.imports.find((j) => j.id === jid);
      job.status = 'canceled';
      return wait({ import: job });
    },
    templateUrl: () => null,
    errorsUrl: () => null,
    annotatedUrl: () => null,
    exportUrl: () => null,

    async rules() { return wait({ rules: db.rules }); },
    async saveRule(rid, body) {
      if (!body.title?.trim()) return fail('Informe um título.');
      if (rid) Object.assign(db.rules.find((r) => r.id === rid), body);
      else db.rules.push({ id: id('rul'), active: true, conditions: {}, ...body });
      log('checklist_rule', rid || 'novo', rid ? 'update' : 'create', body);
      return wait({ ok: true, synced_trips: db.trips.filter((t) => t.status !== 'archived').length });
    },
    async deleteRule(rid) {
      db.rules = db.rules.filter((r) => r.id !== rid);
      return wait({ ok: true });
    },
    async settings() { return wait({ settings: db.settings }); },
    async saveSettings(patch) {
      if (patch.whatsapp_number !== undefined && patch.whatsapp_number && !/^\d{10,15}$/.test(patch.whatsapp_number)) return fail('whatsapp_number: use só dígitos com DDI e DDD (ex.: 5511999990000).');
      const before = Object.fromEntries(Object.keys(patch).map((k) => [k, db.settings[k]]));
      Object.assign(db.settings, patch);
      log('settings', 'global', 'update', patch, null, before);
      return wait({ settings: db.settings });
    },
    async users() { return wait({ users: db.users }); },
    async saveUser(body) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(body.email || '')) return fail('E-mail inválido.');
      db.users.push({ id: id('usr'), email: body.email, name: body.name, role: body.role, last_login_at: null });
      log('user', body.email, 'create', { role: body.role });
      return wait({ ok: true });
    },
    async updateUser(uid, body) {
      const u = db.users.find((x) => x.id === uid);
      if (u.role === 'admin' && body.role && body.role !== 'admin' && db.users.filter((x) => x.role === 'admin').length <= 1) return fail('Não é possível remover o último administrador.', 409);
      Object.assign(u, body.role ? { role: body.role } : {}, body.disabled !== undefined ? { disabled_at: body.disabled ? nowIso() : null } : {});
      return wait({ user: u });
    },
    async audit({ trip_id } = {}) { return wait({ entries: trip_id ? db.audit.filter((a) => a.trip_id === trip_id) : db.audit }); },
    async metrics() {
      const pub = db.trips.filter((t) => t.status === 'published');
      const invited = pub.flatMap((t) => t.travelers).filter((x) => x.invitation_status !== 'not_sent');
      const activated = invited.filter((x) => x.invitation_status === 'accepted');
      const active = db.trips.filter((t) => ['draft', 'published'].includes(t.status));
      return wait({
        period_days: 30,
        activation: { invited: invited.length, activated: activated.length, percent: invited.length ? Math.round((activated.length / invited.length) * 100) : null },
        trips_essential_complete: { trips: active.length, complete: active.filter((t) => summary(t).essential_complete).length, percent: Math.round((active.filter((t) => summary(t).essential_complete).length / active.length) * 100) },
        tasks: { completed: 9, expected: 21, percent: 43 },
        usage: { view_home: 182, view_itinerary: 96, view_documents: 71, view_guide: 64, open_map: 23, whatsapp_click: 12 },
        favorites: 27,
        whatsapp_clicks: 12,
        imports: { total: db.imports.length, completed: db.imports.filter((j) => j.status === 'completed').length, error_rate_percent: 50, avg_minutes_preview_to_confirm: 6.5 },
      });
    },
    async privacyRequests() { return wait({ requests: db.privacy }); },
    async updatePrivacy(pid, status) {
      db.privacy.find((p) => p.id === pid).status = status;
      return wait({ ok: true });
    },
  };
}
