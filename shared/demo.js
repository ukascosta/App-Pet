/**
 * Dados de DEMONSTRAÇÃO (fictícios) e API simulada do viajante, com as MESMAS respostas
 * do servidor real (server/routes/traveler.js). Usada na prévia e no desenvolvimento das telas.
 * Hotéis, códigos e pessoas são inventados; os lugares vêm da biblioteca (shared/library.js).
 */
import { DESTINATIONS, PLACES, destinationName } from './library.js';

const DAY = 86_400_000;
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (date, n) => iso(new Date(Date.parse(date + 'T12:00:00Z') + n * DAY));
const daysBetween = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / DAY);
const mapsUrl = (q) => (q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null);
const dest = (id) => DESTINATIONS.find((d) => d.id === id);

export const SCENARIOS = {
  before: { label: 'Antes da viagem (faltam 38 dias)', offset: 38 },
  soon: { label: 'Embarque em 2 dias', offset: 2 },
  during: { label: 'Durante a viagem (3º dia)', offset: -2 },
  empty: { label: 'Sem viagem cadastrada', offset: null },
};

const CATEGORY_LABELS = {
  itinerary: { transfer: 'Transfer', passeio: 'Passeio', experiencia: 'Experiência', restaurante: 'Restaurante', ingresso: 'Ingresso', transporte: 'Trem / ônibus', livre: 'Tempo livre', outro: 'Outro' },
  booking: { confirmado: 'Confirmado', pendente: 'Pendente', nao_necessario: 'Sem reserva', cancelado: 'Cancelado' },
  document: { bilhete: 'Bilhetes aéreos', reserva: 'Hospedagens', voucher: 'Vouchers', ingresso: 'Ingressos', seguro: 'Seguro viagem', orientacao: 'Guias e orientações', outro: 'Outros' },
  stage: { antes: 'Antes de viajar', ida: 'Ida', destino: 'No destino', volta: 'Volta' },
  place: { ponto_turistico: 'Pontos turísticos', museu_cultura: 'Museus e cultura', restaurante: 'Restaurantes', cafe: 'Cafés', bar: 'Bares', experiencia: 'Experiências', compras: 'Compras', servicos: 'Serviços úteis' },
};
export { CATEGORY_LABELS };

export const INTERESTS = [
  { key: 'gastronomia', label: 'Gastronomia', icon: 'fork-knife' },
  { key: 'cultura', label: 'Cultura', icon: 'bank' },
  { key: 'natureza', label: 'Natureza', icon: 'footprints' },
  { key: 'compras', label: 'Compras', icon: 'shopping-bag' },
  { key: 'aventura', label: 'Aventura', icon: 'fire' },
  { key: 'descanso', label: 'Descanso', icon: 'moon' },
];

export function buildTrips(today, scenario) {
  const offset = SCENARIOS[scenario]?.offset;
  if (offset === null || offset === undefined) return [];
  const s = addDays(today, offset); // início da viagem à Itália
  const d = (n) => addDays(s, n);
  const italy = {
    id: 'VG-2026-014',
    name: 'Itália dos sonhos',
    destination_id: 'italia',
    start_date: s,
    end_date: d(9),
    timezone: 'Europe/Rome',
    cover: 'italia',
    general_notes: 'Na Itália a tomada é tipo L (três pinos em linha). Leva um adaptador universal que resolve!',
    flights: [
      { id: 'f1', segment_order: 1, airline: 'ITA Airways', flight_number: 'AZ 675', departure_airport: 'GRU', departure_city: 'São Paulo', departure_at: `${d(0)}T22:40`, arrival_airport: 'FCO', arrival_city: 'Roma', arrival_at: `${d(1)}T14:55`, booking_reference: 'K7Q2LM', notes: '1 mala de 23 kg + 1 de mão por pessoa. Assentos 32A e 32B.' },
      { id: 'f2', segment_order: 2, airline: 'ITA Airways', flight_number: 'AZ 1460', departure_airport: 'VCE', departure_city: 'Veneza', departure_at: `${d(9)}T10:05`, arrival_airport: 'FCO', arrival_city: 'Roma', arrival_at: `${d(9)}T11:10`, booking_reference: 'K7Q2LM', notes: 'Conexão em Roma.' },
      { id: 'f3', segment_order: 3, airline: 'ITA Airways', flight_number: 'AZ 674', departure_airport: 'FCO', departure_city: 'Roma', departure_at: `${d(9)}T13:30`, arrival_airport: 'GRU', arrival_city: 'São Paulo', arrival_at: `${d(9)}T21:10`, booking_reference: 'K7Q2LM', notes: null },
    ],
    stays: [
      { id: 'h1', name: 'Hotel Fontana Centro', city_id: 'roma', checkin_at: `${d(1)}T15:00`, checkout_at: `${d(5)}T11:00`, address: 'Via del Tritone, Roma', confirmation_code: 'RM-88412', notes: 'Café da manhã incluso, das 7h às 10h30.', latitude: 41.9029, longitude: 12.4856 },
      { id: 'h2', name: 'Residenza Arno', city_id: 'florenca', checkin_at: `${d(5)}T14:00`, checkout_at: `${d(7)}T10:00`, address: "Lungarno degli Acciaiuoli, Firenze", confirmation_code: 'FI-20331', notes: 'Quarto com vista pro rio. Recepção até 22h.', latitude: 43.7692, longitude: 11.2509 },
      { id: 'h3', name: 'Palazzo Laguna', city_id: 'veneza', checkin_at: `${d(7)}T15:00`, checkout_at: `${d(9)}T08:00`, address: 'Fondamenta Zattere, Venezia', confirmation_code: 'VE-55120', notes: 'Chegada de vaporetto: parada Zattere.', latitude: 45.43, longitude: 12.3266 },
    ],
    items: [
      { id: 'i1', date: d(1), start_time: '15:30', end_time: '16:30', city_id: 'roma', title: 'Transfer do aeroporto pro hotel', category: 'transfer', address: 'Aeroporto de Fiumicino (FCO)', description: 'Motorista te espera no desembarque com uma plaquinha "Vagari". Ele acompanha o voo, então relaxa se atrasar.', booking_status: 'confirmado', confirmation_code: 'TR-7781' },
      { id: 'i2', date: d(2), start_time: '09:30', end_time: '12:30', city_id: 'roma', title: 'Coliseu, Fórum e Palatino com guia', category: 'passeio', address: 'Piazza del Colosseo, 1, Roma', description: 'Encontro 15 min antes na saída do metrô Colosseo. Leva água e tênis confortável!', booking_status: 'confirmado', confirmation_code: 'COL-5521', place_id: 'roma-coliseu' },
      { id: 'i3', date: d(2), start_time: '20:00', end_time: null, city_id: 'roma', title: 'Jantar em Trastevere', category: 'restaurante', address: 'Trastevere, Roma', description: 'Mesa reservada pra 2. Pede o cacio e pepe, confia.', booking_status: 'confirmado', confirmation_code: null },
      { id: 'i4', date: d(3), start_time: '08:30', end_time: '12:00', city_id: 'roma', title: 'Museus Vaticanos e Capela Sistina', category: 'ingresso', address: 'Viale Vaticano, Roma', description: 'Ingresso com horário marcado. Ombros e joelhos cobertos pra entrar na Capela Sistina.', booking_status: 'confirmado', confirmation_code: 'VAT-90012', place_id: 'roma-museus-vaticanos' },
      { id: 'i5', date: d(4), start_time: null, end_time: null, city_id: 'roma', title: 'Dia livre pra explorar', category: 'livre', address: null, description: 'Dá uma olhada no Explorar: separamos uns lugares top perto do hotel.', booking_status: 'nao_necessario' },
      { id: 'i6', date: d(4), start_time: '17:00', end_time: '19:30', city_id: 'roma', title: 'Aula de massa fresca', category: 'experiencia', address: 'Monti, Roma', description: 'Você faz o fettuccine e janta o que cozinhou. Bora?', booking_status: 'pendente' },
      { id: 'i7', date: d(5), start_time: '10:15', end_time: '11:51', city_id: 'florenca', title: 'Trem Roma → Florença', category: 'transporte', address: 'Roma Termini', description: 'Frecciarossa, carro 6, poltronas 8A e 8B. Chegue 20 min antes pra ver a plataforma no painel.', booking_status: 'confirmado', confirmation_code: 'FR-4410' },
      { id: 'i8', date: d(6), start_time: '10:00', end_time: '12:30', city_id: 'florenca', title: 'Galeria Uffizi', category: 'ingresso', address: 'Piazzale degli Uffizi, 6, Firenze', description: 'Entrada pela porta 3 (reservas).', booking_status: 'confirmado', confirmation_code: 'UFF-3381', place_id: 'florenca-uffizi' },
      { id: 'i9', date: d(6), start_time: '15:00', end_time: '19:00', city_id: 'florenca', title: 'Tour de vinhos no Chianti', category: 'experiencia', address: 'Piazza della Stazione, Firenze', description: 'Van sai da praça da estação. Inclui 2 vinícolas e degustação.', booking_status: 'confirmado', confirmation_code: 'CH-1180' },
      { id: 'i10', date: d(7), start_time: '11:00', end_time: '13:05', city_id: 'veneza', title: 'Trem Florença → Veneza', category: 'transporte', address: 'Firenze Santa Maria Novella', description: 'Desce em Venezia Santa Lucia (não em Mestre!).', booking_status: 'confirmado', confirmation_code: 'FR-4471' },
      { id: 'i11', date: d(8), start_time: '18:00', end_time: '18:45', city_id: 'veneza', title: 'Passeio de gôndola no pôr do sol', category: 'experiencia', address: 'Bacino Orseolo, Venezia', description: 'O gondoleiro canta se você pedir com jeitinho 😉', booking_status: 'confirmado', confirmation_code: 'GON-208' },
    ],
    documents: [
      { id: 'd1', category: 'bilhete', stage: 'ida', title: 'Bilhetes aéreos ITA Airways', size_bytes: 182000, mime_type: 'application/pdf', version: 1, notes: 'Localizador K7Q2LM' },
      { id: 'd2', category: 'seguro', stage: 'antes', title: 'Apólice do seguro viagem', size_bytes: 96000, mime_type: 'application/pdf', version: 2, notes: 'Cobertura de 60 mil euros. Telefone 24h no verso.' },
      { id: 'd3', category: 'reserva', stage: 'destino', title: 'Hotel Fontana Centro · Roma', size_bytes: 74000, mime_type: 'application/pdf', version: 1 },
      { id: 'd4', category: 'reserva', stage: 'destino', title: 'Residenza Arno · Florença', size_bytes: 71000, mime_type: 'application/pdf', version: 1 },
      { id: 'd5', category: 'reserva', stage: 'destino', title: 'Palazzo Laguna · Veneza', size_bytes: 69000, mime_type: 'application/pdf', version: 1 },
      { id: 'd6', category: 'ingresso', stage: 'destino', title: 'Ingressos Coliseu e Vaticano', size_bytes: 120000, mime_type: 'application/pdf', version: 1 },
      { id: 'd7', category: 'voucher', stage: 'destino', title: 'Vouchers dos trens', size_bytes: 88000, mime_type: 'application/pdf', version: 1 },
      { id: 'd8', category: 'orientacao', stage: 'antes', title: 'Guia Vagari da Itália', size_bytes: 2400000, mime_type: 'application/pdf', version: 1, notes: 'Dicas de gorjeta, transporte e frases úteis.' },
    ],
    tasks: [
      { id: 't1', title: 'Confere os nomes nas reservas', description: 'Seu nome nas passagens tem que estar igualzinho ao do passaporte. Viu algo diferente? Chama a gente.', due_date: null, priority: 'alta' },
      { id: 't2', title: 'Passaporte em dia', description: 'A Itália pede passaporte válido por pelo menos 3 meses depois da volta. Confere a validade aí!', due_date: addDays(s, -105), priority: 'alta', official_url: 'https://www.gov.br/pf/pt-br/assuntos/passaporte' },
      { id: 't3', title: 'Seguro viagem e regras de entrada', description: 'Seu seguro já tá na aba Docs. Dá uma conferida nas regras de entrada da Europa pra brasileiros.', due_date: addDays(s, -75), priority: 'alta', official_url: 'https://www.gov.br/mre/pt-br/assuntos/portal-consular' },
      { id: 't4', title: 'Escolhe o horário da aula de massa', description: 'Tem turma às 11h e às 17h. Responde a gente no WhatsApp que a gente fecha.', due_date: addDays(s, -20), priority: 'media' },
      { id: 't5', title: 'Revisa o roteiro e pensa nos extras', description: 'Quer incluir mais algum passeio? Agora é a hora.', due_date: addDays(s, -30), priority: 'media' },
      { id: 't6', title: 'Monta a mala', description: 'Vai fazer uns 8 a 14 °C. Leva casaco, tênis confortável e o adaptador de tomada.', due_date: addDays(s, -7), priority: 'media' },
      { id: 't7', title: 'Check-in online e ida pro aeroporto', description: 'O check-in abre 24h antes. Chega no GRU com 3h de antecedência, de boa.', due_date: addDays(s, -2), priority: 'alta' },
    ],
    highlights: [
      { place_id: 'roma-fontana-di-trevi', note: 'Vai cedinho, antes das 8h, que é outra experiência.' },
      { place_id: 'florenca-ponte-vecchio', note: 'O pôr do sol aqui é top demais.' },
    ],
    announcements: [
      { id: 'a1', title: 'Partiu Itália! 🇮🇹', body: 'Sua viagem tá montadinha aqui no app. Qualquer dúvida, é só chamar a gente no WhatsApp.', essential: 0, created_at: new Date(Date.parse(today) - 3 * DAY).toISOString() },
    ],
  };
  const rio = {
    id: 'VG-2026-031',
    name: 'Réveillon no Rio',
    destination_id: 'rio',
    start_date: addDays(s, 60),
    end_date: addDays(s, 65),
    timezone: 'America/Sao_Paulo',
    cover: 'rio',
    flights: [], stays: [], items: [], documents: [], tasks: [], highlights: [], announcements: [],
  };
  return [italy, rio];
}

/** API simulada (mesmas rotas e respostas do servidor). Estado só em memória. */
export function createMockApi({ scenario = 'before', now = () => Date.now() } = {}) {
  const today = () => iso(new Date(now()));
  let state = {
    scenario,
    user: { id: 'u1', name: 'Ana Lima', email: 'ana@exemplo.com', phone: null, role: 'traveler', preferences: { interests: [] } },
    trips: buildTrips(today(), scenario),
    done: new Set(['t1']),
    favorites: new Set(['roma-pantheon']),
    notifications: [],
    loggedIn: false,
    prefs: { email_updates: true, email_reminders: true },
    support: { whatsapp: '5511999990000', support_24h: false, hours: 'Seg. a sex., 9h às 18h' },
  };
  const seedNotifications = () => {
    const t = state.trips[0];
    if (!t) return [];
    const ago = (h) => new Date(now() - h * 3_600_000).toISOString();
    return [
      { id: 'n1', trip_id: t.id, kind: 'document', title: 'Novo documento: Ingressos Coliseu e Vaticano', body: 'Já tá na aba Docs, prontinho pra usar.', read_at: null, created_at: ago(2) },
      { id: 'n2', trip_id: t.id, kind: 'task_reminder', title: 'Tarefa: escolhe o horário da aula de massa', body: 'O prazo sugerido vence em 3 dias.', read_at: null, created_at: ago(20) },
      { id: 'n3', trip_id: t.id, kind: 'trip_update', title: 'Seu roteiro foi atualizado', body: 'Incluímos o tour de vinhos no Chianti 🍷', read_at: ago(30), created_at: ago(48) },
      { id: 'n4', trip_id: t.id, kind: 'announcement', title: 'Partiu Itália! 🇮🇹', body: 'Sua viagem tá montadinha aqui no app.', read_at: ago(70), created_at: ago(72) },
    ];
  };
  state.notifications = seedNotifications();

  const findTrip = (id) => {
    const t = state.trips.find((x) => x.id === id);
    if (!t) throw Object.assign(new Error('Viagem não encontrada.'), { status: 404 });
    return t;
  };
  const tripCard = (t) => ({ id: t.id, name: t.name, start_date: t.start_date, end_date: t.end_date, destination_id: t.destination_id, destination_name: destinationName(dest(t.destination_id)), cover: t.cover });
  const whatsapp = (t, extra) => {
    if (!state.support.whatsapp) return null;
    const msg = extra || `Oi, Vagari! Aqui é ${state.user.name}${t ? `, da viagem "${t.name}" (${t.id})` : ''}. Preciso de uma ajuda com: `;
    return `https://wa.me/${state.support.whatsapp}?text=${encodeURIComponent(msg)}`;
  };
  const help = (t) => ({
    whatsapp_url: whatsapp(t),
    support_24h: state.support.support_24h,
    support_hours_text: state.support.support_24h ? 'Atendimento 24 horas' : state.support.hours,
  });
  const tasksFor = (t) =>
    t.tasks
      .map((k) => {
        const done = state.done.has(k.id);
        const days_left = k.due_date ? daysBetween(today(), k.due_date) : null;
        return { ...k, done, completed_at: done ? new Date(now()).toISOString() : null, days_left, overdue: !done && k.due_date ? k.due_date < today() : false };
      })
      .sort((a, b) => a.done - b.done || (a.due_date || '0000').localeCompare(b.due_date || '0000'));
  const progress = (tasks) => {
    const done = tasks.filter((x) => x.done).length;
    return { done, total: tasks.length, percent: tasks.length ? Math.round((done / tasks.length) * 100) : 100 };
  };
  const placeCard = (p, extra = {}) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    category_label: CATEGORY_LABELS.place[p.category],
    destination_id: p.destination,
    destination_name: destinationName(dest(p.destination)),
    short_description: p.description,
    address: p.address,
    maps_url: mapsUrl(p.address),
    official_url: p.url || null,
    tags: p.tags || [],
    photo: p.photo || `place:${p.id}`,
    art: dest(p.destination)?.art,
    latitude: p.lat,
    longitude: p.lng,
    last_verified_at: '2026-10-31',
    is_favorite: state.favorites.has(p.id),
    ...extra,
  });
  const descendants = (rootId) => {
    const out = new Set([rootId]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const d of DESTINATIONS) if (d.parent && out.has(d.parent) && !out.has(d.id)) out.add(d.id), (grew = true);
    }
    return out;
  };
  const km = (a, b) => {
    const R = 6371, r = (x) => (x * Math.PI) / 180;
    const h = Math.sin(r(b.latitude - a.latitude) / 2) ** 2 + Math.cos(r(a.latitude)) * Math.cos(r(b.latitude)) * Math.sin(r(b.longitude - a.longitude) / 2) ** 2;
    return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 10) / 10;
  };
  const delay = (v) => new Promise((r) => setTimeout(() => r(structuredClone(v)), 120));

  return {
    mode: 'demo',
    setScenario(s) {
      const keepFav = state.favorites;
      state.scenario = s;
      state.trips = buildTrips(today(), s);
      state.favorites = keepFav;
      state.notifications = seedNotifications();
    },
    scenario: () => state.scenario,
    setSupport(patch) {
      Object.assign(state.support, patch);
    },

    // --- acesso
    async requestCode(email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email).trim())) throw Object.assign(new Error('Esse e-mail não parece certo. Confere aí?'), { status: 400 });
      return delay({ ok: true });
    },
    async verifyCode(email, code) {
      if (String(code).replace(/\D/g, '').length !== 6) throw Object.assign(new Error('O código tem 6 números.'), { status: 400 });
      state.loggedIn = true;
      state.user.email = String(email).trim().toLowerCase();
      return delay({ user: state.user, token: 'demo' });
    },
    async socialLogin(provider) {
      state.loggedIn = true;
      return delay({ user: state.user, token: 'demo', provider });
    },
    async inviteInfo() {
      return delay({ trip_name: 'Itália dos sonhos', traveler_first_name: 'Ana' });
    },
    async acceptInvite() {
      state.loggedIn = true;
      return delay({ user: state.user, trip_id: state.trips[0]?.id, token: 'demo' });
    },
    async logout() {
      state.loggedIn = false;
      return delay({ ok: true });
    },

    // --- perfil
    async me() {
      return delay({ user: state.user, notification_prefs: state.prefs, trips: state.trips.map(tripCard), options: { interests: INTERESTS } });
    },
    async updateMe(patch) {
      if (patch.name !== undefined) state.user.name = patch.name;
      if (patch.preferences) state.user.preferences = { ...state.user.preferences, ...patch.preferences };
      if (patch.notification_prefs) Object.assign(state.prefs, patch.notification_prefs);
      return delay({ ok: true });
    },
    async privacyRequest(kind) {
      return delay({ id: 'prv1', kind, message: 'Recebemos seu pedido! A gente responde no seu e-mail.' });
    },

    // --- viagem
    async home(tripId) {
      const t = findTrip(tripId);
      const td = today();
      const toStart = daysBetween(td, t.start_date);
      const phase = toStart > 0 ? 'before' : td <= t.end_date ? 'during' : 'after';
      const nextFlight = t.flights.find((f) => f.departure_at.slice(0, 10) >= td) || null;
      const stay = t.stays.find((a) => a.checkin_at.slice(0, 10) <= td && a.checkout_at.slice(0, 10) > td) || t.stays.find((a) => a.checkin_at.slice(0, 10) >= td) || null;
      const tasks = tasksFor(t);
      return delay({
        trip: { id: t.id, name: t.name, start_date: t.start_date, end_date: t.end_date, timezone: t.timezone, cover: t.cover, general_notes: t.general_notes, destination: { id: t.destination_id, name: destinationName(dest(t.destination_id)), country: dest(t.destination_id)?.country } },
        cities: [...new Set(t.stays.map((s) => destinationName(dest(s.city_id))))],
        countdown: { days_to_start: Math.max(toStart, 0), phase, day_number: phase === 'during' ? daysBetween(t.start_date, td) + 1 : null, total_days: daysBetween(t.start_date, t.end_date) + 1 },
        next_flight: nextFlight,
        accommodation: stay ? { ...stay, maps_url: mapsUrl(stay.address) } : null,
        upcoming: t.items.filter((i) => i.date >= td).slice(0, 3).map((i) => ({ ...i, category_label: CATEGORY_LABELS.itinerary[i.category], maps_url: mapsUrl(i.address) })),
        progress: progress(tasks),
        next_task: tasks.find((k) => !k.done) || null,
        announcements: t.announcements,
        help: help(t),
        other_trips: state.trips.filter((x) => x.id !== t.id).map(tripCard),
        counts: { documents: t.documents.length, items: t.items.length },
      });
    },
    async itinerary(tripId) {
      const t = findTrip(tripId);
      const days = new Map();
      const push = (date, item) => (days.has(date) || days.set(date, []), days.get(date).push(item));
      for (const f of t.flights)
        push(f.departure_at.slice(0, 10), { type: 'flight', id: f.id, time: f.departure_at.slice(11, 16), title: `${f.departure_city} → ${f.arrival_city}`, subtitle: `${f.airline} · ${f.flight_number}`, ...f });
      for (const a of t.stays) {
        const base = { id: a.id, title: a.name, name: a.name, address: a.address, maps_url: mapsUrl(a.address), confirmation_code: a.confirmation_code, notes: a.notes, city_id: a.city_id, city: destinationName(dest(a.city_id)), checkin_at: a.checkin_at, checkout_at: a.checkout_at };
        push(a.checkin_at.slice(0, 10), { ...base, type: 'checkin', time: a.checkin_at.slice(11, 16) });
        push(a.checkout_at.slice(0, 10), { ...base, type: 'checkout', time: a.checkout_at.slice(11, 16) });
      }
      for (const i of t.items)
        push(i.date, { type: 'activity', ...i, time: i.start_time, category_label: CATEGORY_LABELS.itinerary[i.category], booking_status_label: CATEGORY_LABELS.booking[i.booking_status], maps_url: mapsUrl(i.address), city: destinationName(dest(i.city_id)) });
      for (let d = t.start_date; d <= t.end_date; d = addDays(d, 1)) if (!days.has(d)) days.set(d, []);
      const td = today();
      const cityOf = (date) => {
        const s = t.stays.find((a) => a.checkin_at.slice(0, 10) <= date && a.checkout_at.slice(0, 10) > date);
        return s ? destinationName(dest(s.city_id)) : null;
      };
      return delay({
        timezone: t.timezone,
        days: [...days.entries()]
          .sort(([a], [b]) => (a < b ? -1 : 1))
          .map(([date, items]) => ({ date, city: cityOf(date), day_number: daysBetween(t.start_date, date) + 1, is_today: date === td, items: items.sort((a, b) => (a.time || '99').localeCompare(b.time || '99')) })),
      });
    },
    async tasks(tripId) {
      const tasks = tasksFor(findTrip(tripId));
      return delay({ tasks, progress: progress(tasks) });
    },
    async setTaskDone(tripId, taskId, done) {
      findTrip(tripId);
      done ? state.done.add(taskId) : state.done.delete(taskId);
      return delay({ ok: true });
    },
    async documents(tripId) {
      const t = findTrip(tripId);
      const docs = t.documents.map((d) => ({ ...d, category_label: CATEGORY_LABELS.document[d.category], stage_label: CATEGORY_LABELS.stage[d.stage], updated_at: new Date(now() - 4 * DAY).toISOString() }));
      const groups = Object.entries(CATEGORY_LABELS.document)
        .map(([k, label]) => ({ category: k, label, documents: docs.filter((d) => d.category === k) }))
        .filter((g) => g.documents.length);
      return delay({ documents: docs, groups });
    },
    async guide(tripId, { q, category, favorites, near } = {}) {
      const t = findTrip(tripId);
      const ids = new Set([...descendants(t.destination_id), ...t.stays.map((s) => s.city_id)]);
      const hl = new Map(t.highlights.map((h) => [h.place_id, h.note]));
      let anchor = null;
      if (near === 'hotel') anchor = t.stays.find((s) => s.checkout_at.slice(0, 10) > today()) || t.stays[0];
      let places = PLACES.filter((p) => ids.has(p.destination) || hl.has(p.id)).map((p) =>
        placeCard(p, { highlight: hl.has(p.id), highlight_note: hl.get(p.id) || null, distance_km: anchor ? km(anchor, { latitude: p.lat, longitude: p.lng }) : null }),
      );
      if (category) places = places.filter((p) => p.category === category);
      if (q) {
        const n = q.toLowerCase();
        places = places.filter((p) => (p.name + p.short_description + p.tags.join(' ')).toLowerCase().includes(n));
      }
      if (favorites) places = places.filter((p) => p.is_favorite);
      places.sort((a, b) => (a.highlight !== b.highlight ? (a.highlight ? -1 : 1) : anchor ? a.distance_km - b.distance_km : a.name.localeCompare(b.name)));
      const cats = Object.entries(CATEGORY_LABELS.place)
        .map(([key, label]) => ({ key, label }))
        .filter((c) => PLACES.some((p) => ids.has(p.destination) && p.category === c.key));
      return delay({ places, categories: cats, destinations: [...ids].map((id) => ({ id, name: destinationName(dest(id)) })), near_hotel: anchor ? { name: anchor.name } : null });
    },
    async place(id) {
      const p = PLACES.find((x) => x.id === id);
      if (!p) throw Object.assign(new Error('Lugar não encontrado.'), { status: 404 });
      const trip = state.trips[0];
      const note = trip?.highlights.find((h) => h.place_id === id)?.note || null;
      const nearby = PLACES.filter((x) => x.destination === p.destination && x.id !== id).slice(0, 4).map((x) => placeCard(x));
      return delay({ place: placeCard(p, { highlight: !!note, highlight_note: note, nearby }) });
    },
    async setFavorite(id, on) {
      on ? state.favorites.add(id) : state.favorites.delete(id);
      return delay({ ok: true, is_favorite: on });
    },
    async favorites() {
      return delay({ places: PLACES.filter((p) => state.favorites.has(p.id)).map((p) => placeCard(p)) });
    },
    async help(tripId) {
      return delay(help(tripId ? findTrip(tripId) : null));
    },
    async notifications() {
      return delay({ notifications: state.notifications, unread: state.notifications.filter((n) => !n.read_at).length });
    },
    async readNotifications() {
      for (const n of state.notifications) n.read_at = n.read_at || new Date(now()).toISOString();
      return delay({ ok: true });
    },
    async event() {
      return { ok: true };
    },

    // --- inspiração (biblioteca de destinos)
    async inspiration() {
      const cities = DESTINATIONS.filter((d) => d.tagline && (d.city || !DESTINATIONS.some((c) => c.parent === d.id)));
      return delay({ destinations: cities.map((d) => ({ id: d.id, name: destinationName(d), country: d.country, tagline: d.tagline, photo: d.photo || `dest:${d.id}`, art: d.art })) });
    },
    async destination(id) {
      const d = dest(id);
      const ids = descendants(id);
      return delay({
        destination: { id: d.id, name: destinationName(d), country: d.country, tagline: d.tagline, overview: d.overview, best_season: d.best_season, timezone: d.timezone, photo: d.photo || `dest:${d.id}`, art: d.art },
        places: PLACES.filter((p) => ids.has(p.destination)).map((p) => placeCard(p)),
        whatsapp_url: whatsapp(null, `Oi, Vagari! Tô sonhando com ${destinationName(d)} ✈️ Bora montar essa viagem?`),
      });
    },
  };
}
