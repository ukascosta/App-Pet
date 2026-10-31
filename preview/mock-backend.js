// Servidor SIMULADO da pré-visualização: responde às mesmas rotas da API real, dentro do navegador.
// Os cálculos (porção, rotina, estoque, avisos) usam os mesmos módulos do servidor de verdade.
// Os dados ficam só no localStorage deste navegador e são fictícios. Senhas aqui NÃO são protegidas.

import { findBreed, breedsOf, BREEDS } from '../server/data/breeds.js';
import { MAX_MEALS, TIME_PATTERN, defaultTimes } from '../server/lib/feeding.js';
import { DAY_MS, recommend } from '../server/lib/nutrition.js';
import { formatWhatsApp, normalizeWhatsApp, whatsAppLink } from '../server/lib/phone.js';
import { recommendationFor, resolveDailyGrams, serializePet } from '../server/lib/pet-model.js';
import { currentStockG, stockStatus } from '../server/lib/stock.js';
import { HttpError, bool, email as validEmail, number, oneOf, text } from '../server/lib/validate.js';
import { customerAlert, storeAlert, storeGreeting } from '../server/services/messages.js';
import { storeFeatureRoutes, tutorRoutes } from '../server/features/api.js';
import { CARE_KINDS, dueReminders } from '../server/features/care.js';
import { seedCustomers, seedDemoTutor, seedStore } from '../server/features/demo.js';
import { memoryRepo } from '../server/features/repo-memory.js';
import { settingsOf } from '../server/features/settings.js';

export const STORE = { name: 'Pet Shop do Bairro', whatsapp: '5511988887777', key: 'loja123' };
export const DEMO_LOGIN = { email: 'maria@example.com', password: 'senha12345' };

const KEY = 'petlee.preview.state';
const MONTH_MS = DAY_MS * 30.4375;
const SEVERITY = { ok: 0, low: 1, empty: 2 };

const blank = () => ({ v: 2, seq: {}, customers: [], sessions: {}, pets: [], alerts: [], leads: [], mailbox: [], resets: {}, codes: {}, offsetMs: 0 });
let S = blank();
let memoryOnly = false; // navegador bloqueou o armazenamento: o estado vive só enquanto a página estiver aberta

export function load() {
  if (memoryOnly) return S;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    S = saved?.v === 2 ? saved : blank();
  } catch (err) {
    // JSON ruim: recomeça. Armazenamento bloqueado (SecurityError): mantém o que já está na memória.
    if (err instanceof SyntaxError) S = blank();
    else memoryOnly = true;
  }
  return S;
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(S));
  } catch {
    /* sem armazenamento: o estado vale só até recarregar */
  }
  try {
    // A moldura recebe o estado direto por aqui; assim as mensagens aparecem mesmo se o navegador bloquear o armazenamento.
    window.parent.postMessage({ petlee: 'state', mailbox: S.mailbox, offsetMs: S.offsetMs || 0 }, '*');
  } catch {
    /* fora de moldura */
  }
}

export const now = () => Date.now() + (S.offsetMs || 0);
// Os módulos comerciais também inserem linhas (repo-memory): o próximo id parte do maior que já existe.
const TABLE = { customer: 'customers', pet: 'pets', lead: 'leads', alert: 'alerts', mail: 'mailbox' };
const nextId = (k) => {
  const max = (S[TABLE[k]] ?? []).reduce((m, r) => Math.max(m, r.id || 0), 0);
  return (S.seq[k] = Math.max(S.seq[k] || 0, max) + 1);
};
const randomToken = () => {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
};
const fakeHash = (pw) => `demo:${btoa(unescape(encodeURIComponent(pw)))}`;

// ---------- caixa de mensagens simuladas (o que sairia por WhatsApp, e-mail e push) ----------
function mail(kind, data) {
  S.mailbox.unshift({ id: nextId('mail'), at: now(), kind, ...data });
  S.mailbox = S.mailbox.slice(0, 60);
}

const pushOn = () => {
  try {
    return localStorage.getItem('petlee.preview.push') === 'on';
  } catch {
    return false;
  }
};

const pub = (c) => ({
  id: c.id,
  name: c.name,
  email: c.email,
  whatsapp: c.whatsapp ?? null,
  profileComplete: Boolean(c.whatsapp && c.consent_at),
  hasPassword: Boolean(c.pw),
  providers: [c.google_id && 'google', c.facebook_id && 'facebook'].filter(Boolean),
});

function startSession(customerId) {
  const token = randomToken();
  S.sessions[token] = customerId;
  return token;
}

// ---------- pets ----------
function parsePet(body, at, current) {
  const species = oneOf(body.species, 'species', ['dog', 'cat'], 'cão ou gato');
  const breed = findBreed(body.breedId);
  if (!breed || breed.species !== species) throw new HttpError(400, 'Escolha a raça do pet.', 'breedId');

  const years = number(body.ageYears ?? 0, 'ageYears', 'a idade em anos', { min: 0, max: 30 });
  const months = number(body.ageMonths ?? 0, 'ageMonths', 'a idade em meses', { min: 0, max: 11 });
  const ageMonths = Math.round(years) * 12 + Math.round(months);
  const currentAge = current ? Math.floor((at - current.birth_at) / MONTH_MS) : null;
  const birthAt = current && ageMonths === currentAge ? current.birth_at : at - ageMonths * MONTH_MS;

  const monthlyKg = number(body.monthlyPurchaseKg, 'monthlyPurchaseKg', 'quanto você compra por mês', { min: 0.5, max: 200 });
  const mode = oneOf(body.dailyMode ?? 'recommended', 'dailyMode', ['recommended', 'purchase', 'custom'], 'como calcular o consumo');

  const pet = {
    name: text(body.name, 'name', 'o nome do pet', { min: 1, max: 40 }),
    species,
    breed_id: breed.id,
    breed_name: breed.other ? text(body.breedName || 'Outra raça', 'breedName', 'a raça', { max: 60 }) : breed.name,
    adult_kg: breed.other ? number(body.adultKg, 'adultKg', 'o peso adulto aproximado', { min: 1, max: 100 }) : breed.adultKg,
    color: text(body.color, 'color', 'a cor do pet', { max: 30 }),
    birth_at: birthAt,
    weight_kg: number(body.weightKg, 'weightKg', 'o peso', { min: 0.3, max: 120, optional: true }),
    neutered: bool(body.neutered, true) ? 1 : 0,
    kcal_per_kg: number(body.kcalPerKg, 'kcalPerKg', 'a energia da ração', { min: 2500, max: 5500, optional: true }),
    monthly_purchase_g: Math.round(monthlyKg * 1000),
    daily_mode: mode,
    alert_days: Math.round(number(body.alertDays ?? 7, 'alertDays', 'os dias de antecedência', { min: 1, max: 30 })),
  };

  const suggested = recommendationFor(pet, at).schedule;
  pet.meals_per_day = Math.round(number(body.mealsPerDay ?? suggested.meals, 'mealsPerDay', 'quantas refeições por dia', { min: 1, max: MAX_MEALS }));
  let times = body.mealTimes;
  if (times === undefined || times === null || times.length === 0) times = defaultTimes(pet.meals_per_day);
  if (!Array.isArray(times) || times.length !== pet.meals_per_day || !times.every((t) => typeof t === 'string' && TIME_PATTERN.test(t))) {
    throw new HttpError(400, 'Informe um horário válido para cada refeição.', 'mealTimes');
  }
  if (new Set(times).size !== times.length) throw new HttpError(400, 'Os horários das refeições não podem se repetir.', 'mealTimes');
  pet.meal_times = JSON.stringify([...times].sort());

  const customGrams = mode === 'custom' ? number(body.customDailyGrams, 'customDailyGrams', 'quantos gramas por dia', { min: 5, max: 5000 }) : null;
  pet.daily_g = resolveDailyGrams({ mode, customGrams, monthlyPurchaseGrams: pet.monthly_purchase_g, recommendedGrams: recommendationFor(pet, at).dailyGrams });
  return pet;
}

function createPet(customer, body) {
  const at = now();
  const pet = parsePet(body, at);
  const stockKg = number(body.stockKg ?? body.monthlyPurchaseKg, 'stockKg', 'quanto tem de ração em casa', { min: 0, max: 200 });
  const row = { id: nextId('pet'), customer_id: customer.id, ...pet, stock_g: stockKg * 1000, stock_at: at, alert_state: 'ok', created_at: at };
  S.pets.push(row);
  evaluatePet(row);
  return row;
}

// ---------- avisos (mesma máquina de estados do servidor: ok -> acabando -> acabou) ----------
const openLead = (petId) => S.leads.find((l) => l.pet_id === petId && ['new', 'contacted'].includes(l.status));

function evaluatePet(pet) {
  const at = now();
  const status = stockStatus(pet, at);
  const prev = pet.alert_state;
  const next = status.level;
  if (next === prev) return;
  pet.alert_state = next;

  if (next === 'ok') {
    for (const l of S.leads.filter((x) => x.pet_id === pet.id && ['new', 'contacted'].includes(x.status))) {
      l.status = 'closed';
      l.note = l.note ? `${l.note} | Estoque reposto pelo cliente.` : 'Estoque reposto pelo cliente.';
      l.updated_at = at;
    }
    return;
  }
  if (SEVERITY[next] < SEVERITY[prev]) return;

  const customer = S.customers.find((c) => c.id === pet.customer_id);
  const kind = next;
  const daysLeft = Math.max(0, status.daysLeft);
  const suggestedKg = Math.round(pet.monthly_purchase_g / 100) / 10;

  let lead = openLead(pet.id);
  if (lead) Object.assign(lead, { kind, days_left: daysLeft, updated_at: at });
  else {
    lead = { id: nextId('lead'), customer_id: customer.id, pet_id: pet.id, kind, status: 'new', days_left: daysLeft, suggested_kg: suggestedKg, note: '', created_at: at, updated_at: at };
    S.leads.push(lead);
  }

  const msg = customerAlert({ petName: pet.name, storeName: STORE.name, kind, daysLeft });
  S.alerts.unshift({ id: nextId('alert'), customer_id: customer.id, pet_id: pet.id, kind, title: msg.title, body: msg.body, created_at: at, read_at: null });
  mail('whatsapp', {
    to: STORE.whatsapp,
    title: kind === 'empty' ? 'Ração acabou' : 'Ração acabando',
    body: storeAlert({ customer, pet: { name: pet.name, breedName: pet.breed_name, color: pet.color }, kind, daysLeft, suggestedKg }),
  });
  mail('email', { to: customer.email, title: msg.title, body: msg.body });
  if (pushOn()) mail('push', { to: customer.name, title: msg.title, body: msg.body, hash: `#/pet/${pet.id}` });
}

/** Equivalente ao conferidor periódico do servidor: fixa o estoque de agora e dispara o que for preciso. */
export function runCheck() {
  const at = now();
  for (const pet of S.pets) {
    const daily = pet.daily_mode === 'recommended' ? recommendationFor(pet, at).dailyGrams : pet.daily_g;
    pet.stock_g = currentStockG(pet, at);
    pet.stock_at = at;
    pet.daily_g = daily;
    evaluatePet(pet);
  }
  const repo = memoryRepo(S);
  for (const ev of dueReminders(S.care ?? [], at, settingsOf(repo).careLeadDays)) {
    const pet = S.pets.find((p) => p.id === ev.pet_id);
    notifyCustomer(ev.customer_id, { title: `${CARE_KINDS[ev.kind] ?? ev.title} de ${pet?.name ?? 'seu pet'}`, body: `Data cadastrada: ${new Date(ev.due_at).toLocaleDateString('pt-BR')}.`, url: '#/agenda', kind: 'care', petId: ev.pet_id });
    ev.notified_at = at;
  }
}

/** Aviso no app (e push simulado) para o tutor: pedido confirmado, lembrete, campanha... */
function notifyCustomer(customerId, { title, body, url = '#/avisos', kind = 'info', petId = null }) {
  S.alerts.unshift({ id: nextId('alert'), customer_id: customerId, pet_id: petId, kind, title, body, created_at: now(), read_at: null });
  const c = S.customers.find((x) => x.id === customerId);
  if (c && pushOn()) mail('push', { to: c.name, title, body, hash: url });
}

const hooks = {
  notify: notifyCustomer,
  restock(petId, kg) {
    const pet = S.pets.find((p) => p.id === petId);
    if (!pet) return;
    const at = now();
    Object.assign(pet, { stock_g: currentStockG(pet, at) + kg * 1000, stock_at: at });
    evaluatePet(pet);
  },
  storeNotice: (body) => mail('whatsapp', { to: STORE.whatsapp, title: 'Aviso do app', body }),
};

export function advanceDays(days) {
  load();
  S.offsetMs = days === 0 ? 0 : (S.offsetMs || 0) + days * DAY_MS;
  runCheck();
  save();
}

// ---------- rotas ----------
const ok = (body, status = 200) => ({ status, body });
const noContent = () => ({ status: 204, body: null });

function authed(headers) {
  const token = /^Bearer (\S+)$/.exec(headers.authorization ?? '')?.[1];
  const id = token && S.sessions[token];
  const customer = id && S.customers.find((c) => c.id === id);
  if (!customer) throw new HttpError(401, 'Sua sessão expirou. Entre novamente.');
  return { customer, token };
}

const storeGuard = (headers) => {
  if ((headers['x-store-key'] ?? '') !== STORE.key) throw new HttpError(401, 'Senha da loja incorreta.');
};

const ownedPet = (customer, id) => {
  const pet = S.pets.find((p) => p.id === Number(id) && p.customer_id === customer.id);
  if (!pet) throw new HttpError(404, 'Pet não encontrado.');
  return pet;
};

function password(value, field = 'password') {
  if (typeof value !== 'string' || value.length < 8) throw new HttpError(400, 'A senha precisa ter pelo menos 8 caracteres.', field);
  return value;
}

function leadView(l) {
  const c = S.customers.find((x) => x.id === l.customer_id);
  const p = S.pets.find((x) => x.id === l.pet_id);
  return {
    id: l.id, kind: l.kind, status: l.status, note: l.note,
    daysLeft: Math.round(l.days_left * 10) / 10,
    suggestedKg: l.suggested_kg,
    createdAt: new Date(l.created_at).toISOString(),
    customer: { name: c.name, email: c.email, whatsapp: formatWhatsApp(c.whatsapp) },
    pet: { name: p.name, breed: p.breed_name, color: p.color, species: p.species },
    whatsappLink: whatsAppLink(c.whatsapp, storeGreeting({ customerName: c.name, petName: p.name, storeName: STORE.name })),
    delivery: { status: 'sent', error: null },
  };
}

const ROUTES = [
  ['GET', /^\/config$/, () => ok({
    store: { name: STORE.name, whatsapp: STORE.whatsapp },
    vapidPublicKey: 'preview',
    feeding: { times: Object.fromEntries(Array.from({ length: MAX_MEALS }, (_, i) => [i + 1, defaultTimes(i + 1)])) },
    auth: { google: true, facebook: true, preview: true },
  })],

  ['GET', /^\/breeds$/, ({ query }) => {
    const list = query.get('species') ? breedsOf(oneOf(query.get('species'), 'species', ['dog', 'cat'], 'cão ou gato')) : BREEDS;
    return ok(list.map(({ id, name, species, size, minKg, maxKg, other }) => ({ id, name, species, size, minKg, maxKg, other: !!other })));
  }],

  ['POST', /^\/recommendation$/, ({ body: b }) => {
    const species = oneOf(b.species, 'species', ['dog', 'cat'], 'cão ou gato');
    const breed = findBreed(b.breedId);
    if (!breed || breed.species !== species) throw new HttpError(400, 'Escolha a raça do pet.', 'breedId');
    const adultKg = breed.other ? number(b.adultKg, 'adultKg', 'o peso adulto aproximado', { min: 1, max: 100 }) : breed.adultKg;
    const years = number(b.ageYears ?? 0, 'ageYears', 'a idade em anos', { min: 0, max: 30 });
    const months = number(b.ageMonths ?? 0, 'ageMonths', 'a idade em meses', { min: 0, max: 11 });
    return ok(recommend({
      species, adultKg, ageMonths: years * 12 + months,
      weightKg: number(b.weightKg, 'weightKg', 'o peso', { min: 0.3, max: 120, optional: true }) ?? undefined,
      neutered: bool(b.neutered, true),
      kcalPerKg: number(b.kcalPerKg, 'kcalPerKg', 'a energia da ração', { min: 2500, max: 5500, optional: true }) ?? undefined,
      deepChested: breed.deepChested ?? false,
    }));
  }],

  // ----- cadastro e login -----
  ['POST', /^\/customers$/, ({ body: b }) => {
    const name = text(b.name, 'name', 'seu nome', { min: 2, max: 80 });
    const mail_ = validEmail(b.email);
    const whatsapp = normalizeWhatsApp(b.whatsapp);
    if (!whatsapp) throw new HttpError(400, 'Informe um WhatsApp válido com DDD, ex.: (11) 99999-8888.', 'whatsapp');
    const pw = password(b.password);
    if (b.consent !== true) throw new HttpError(400, 'Para avisar você e a loja, precisamos da sua autorização.', 'consent');
    const clash = S.customers.find((c) => c.email === mail_ || c.whatsapp === whatsapp);
    if (clash) {
      const isEmail = clash.email === mail_;
      throw new HttpError(409, `Já existe um cadastro com este ${isEmail ? 'e-mail' : 'WhatsApp'}. Toque em "Entrar" para acessar.`, isEmail ? 'email' : 'whatsapp');
    }
    const c = { id: nextId('customer'), name, email: mail_, whatsapp, consent_at: now(), pw: fakeHash(pw), created_at: now() };
    S.customers.push(c);
    return ok({ token: startSession(c.id), customer: pub(c) }, 201);
  }],

  ['POST', /^\/session$/, ({ body: b }) => {
    const mail_ = validEmail(b.email);
    const c = S.customers.find((x) => x.email === mail_);
    if (!c || !c.pw || c.pw !== fakeHash(String(b.password ?? ''))) throw new HttpError(401, 'E-mail ou senha incorretos.', 'password');
    return ok({ token: startSession(c.id), customer: pub(c) });
  }],

  ['DELETE', /^\/session$/, ({ auth }) => {
    delete S.sessions[auth().token];
    return noContent();
  }],

  ['POST', /^\/password\/forgot$/, ({ body: b }) => {
    const mail_ = validEmail(b.email);
    const c = S.customers.find((x) => x.email === mail_);
    if (c) {
      const token = randomToken();
      S.resets[token] = { customerId: c.id, exp: now() + 60 * 60_000 };
      mail('email', {
        to: c.email,
        title: 'Crie uma nova senha no PetLee',
        body: `Olá, ${c.name.split(' ')[0]}!\n\nPara criar uma nova senha, abra o link abaixo (vale por 1 hora).\n\nSe não foi você que pediu, ignore este e-mail: nada muda na sua conta.`,
        hash: `#/senha/redefinir?token=${token}`,
        linkLabel: 'Criar nova senha',
      });
    }
    return noContent();
  }],

  ['POST', /^\/password\/reset$/, ({ body: b }) => {
    const pw = password(b.password);
    const r = S.resets[b.token];
    if (!r || r.exp < now()) throw new HttpError(400, 'Este link expirou ou já foi usado. Peça um novo.', 'token');
    delete S.resets[b.token];
    const c = S.customers.find((x) => x.id === r.customerId);
    c.pw = fakeHash(pw);
    for (const t of Object.keys(S.sessions)) if (S.sessions[t] === c.id) delete S.sessions[t];
    return ok({ token: startSession(c.id), customer: pub(c) });
  }],

  ['PUT', /^\/me\/password$/, ({ auth, body: b }) => {
    const { customer, token } = auth();
    if (customer.pw && customer.pw !== fakeHash(String(b.currentPassword ?? ''))) throw new HttpError(400, 'A senha atual está incorreta.', 'currentPassword');
    customer.pw = fakeHash(password(b.newPassword, 'newPassword'));
    for (const t of Object.keys(S.sessions)) if (S.sessions[t] === customer.id && t !== token) delete S.sessions[t];
    return noContent();
  }],

  ['POST', /^\/oauth\/exchange$/, ({ body: b }) => {
    const id = S.codes[b.code];
    if (!id) throw new HttpError(400, 'O login expirou. Tente novamente.');
    delete S.codes[b.code];
    return ok({ token: startSession(id), customer: pub(S.customers.find((c) => c.id === id)) });
  }],

  // ----- perfil -----
  ['GET', /^\/me$/, ({ auth }) => {
    const { customer } = auth();
    const at = now();
    return ok({
      customer: pub(customer),
      pets: S.pets.filter((p) => p.customer_id === customer.id).map((p) => serializePet(p, at)),
      unreadAlerts: S.alerts.filter((a) => a.customer_id === customer.id && !a.read_at).length,
    });
  }],

  ['PATCH', /^\/me$/, ({ auth, body: b }) => {
    const { customer } = auth();
    const name = text(b.name, 'name', 'seu nome', { min: 2, max: 80 });
    const whatsapp = normalizeWhatsApp(b.whatsapp);
    if (!whatsapp) throw new HttpError(400, 'Informe um WhatsApp válido com DDD, ex.: (11) 99999-8888.', 'whatsapp');
    if (!customer.consent_at && b.consent !== true) throw new HttpError(400, 'Para avisar você e a loja, precisamos da sua autorização.', 'consent');
    if (S.customers.some((c) => c.whatsapp === whatsapp && c.id !== customer.id)) throw new HttpError(409, 'Este WhatsApp já está em uso em outro cadastro.', 'whatsapp');
    Object.assign(customer, { name, whatsapp, consent_at: customer.consent_at ?? now() });
    return ok({ customer: pub(customer) });
  }],

  ['DELETE', /^\/me$/, ({ auth }) => {
    const { customer } = auth();
    const petIds = new Set(S.pets.filter((p) => p.customer_id === customer.id).map((p) => p.id));
    S.customers = S.customers.filter((c) => c.id !== customer.id);
    S.pets = S.pets.filter((p) => !petIds.has(p.id));
    for (const [k, v] of Object.entries(S)) if (Array.isArray(v) && v.some((r) => r?.customer_id === customer.id)) S[k] = v.filter((r) => r.customer_id !== customer.id);
    for (const t of Object.keys(S.sessions)) if (S.sessions[t] === customer.id) delete S.sessions[t];
    return noContent();
  }],

  // ----- pets -----
  ['POST', /^\/pets$/, ({ auth, body }) => {
    const { customer } = auth();
    if (!customer.whatsapp || !customer.consent_at) throw new HttpError(403, 'Complete seu cadastro (WhatsApp e autorização) antes de adicionar um pet.', 'profile');
    if (S.pets.filter((p) => p.customer_id === customer.id).length >= 10) throw new HttpError(400, 'Limite de 10 pets por cadastro.');
    const row = createPet(customer, body);
    return ok({ pet: serializePet(row, now()) }, 201);
  }],

  ['GET', /^\/pets\/(\d+)$/, ({ auth, params }) => ok({ pet: serializePet(ownedPet(auth().customer, params[0]), now()) })],

  ['PATCH', /^\/pets\/(\d+)$/, ({ auth, params, body }) => {
    const pet = ownedPet(auth().customer, params[0]);
    const at = now();
    const next = parsePet(body, at, pet);
    const stockG = body.stockKg === undefined ? currentStockG(pet, at) : number(body.stockKg, 'stockKg', 'o estoque', { min: 0, max: 200 }) * 1000;
    Object.assign(pet, next, { stock_g: stockG, stock_at: at });
    evaluatePet(pet);
    return ok({ pet: serializePet(pet, now()) });
  }],

  ['DELETE', /^\/pets\/(\d+)$/, ({ auth, params }) => {
    const pet = ownedPet(auth().customer, params[0]);
    S.pets = S.pets.filter((p) => p.id !== pet.id);
    S.leads = S.leads.filter((l) => l.pet_id !== pet.id);
    S.alerts = S.alerts.filter((a) => a.pet_id !== pet.id);
    return noContent();
  }],

  ['POST', /^\/pets\/(\d+)\/restock$/, ({ auth, params, body }) => {
    const pet = ownedPet(auth().customer, params[0]);
    const at = now();
    const addKg = number(body.kg ?? pet.monthly_purchase_g / 1000, 'kg', 'a quantidade comprada', { min: 0.1, max: 200 });
    Object.assign(pet, { stock_g: currentStockG(pet, at) + addKg * 1000, stock_at: at });
    evaluatePet(pet);
    return ok({ pet: serializePet(pet, now()) });
  }],

  ['POST', /^\/pets\/(\d+)\/stock$/, ({ auth, params, body }) => {
    const pet = ownedPet(auth().customer, params[0]);
    const kg = number(body.kg, 'kg', 'quanto tem de ração em casa', { min: 0, max: 200 });
    Object.assign(pet, { stock_g: kg * 1000, stock_at: now() });
    evaluatePet(pet);
    return ok({ pet: serializePet(pet, now()) });
  }],

  // ----- avisos -----
  ['GET', /^\/alerts$/, ({ auth }) => ok({
    alerts: S.alerts.filter((a) => a.customer_id === auth().customer.id).slice(0, 50).map((a) => ({
      id: a.id, petId: a.pet_id, kind: a.kind, title: a.title, body: a.body, createdAt: new Date(a.created_at).toISOString(), read: a.read_at !== null,
    })),
  })],

  ['POST', /^\/alerts\/read$/, ({ auth }) => {
    for (const a of S.alerts) if (a.customer_id === auth().customer.id && !a.read_at) a.read_at = now();
    return noContent();
  }],

  ['POST', /^\/push\/(un)?subscribe$/, () => noContent()],

  // ----- painel da loja -----
  ['GET', /^\/store\/leads$/, ({ headers, query }) => {
    storeGuard(headers);
    const filter = query.get('status') ?? 'open';
    const counts = { new: 0, contacted: 0, sold: 0, closed: 0 };
    for (const l of S.leads) counts[l.status]++;
    let rows;
    if (filter === 'open') rows = S.leads.filter((l) => ['new', 'contacted'].includes(l.status)).sort((a, b) => (b.kind === 'empty') - (a.kind === 'empty') || b.created_at - a.created_at);
    else if (filter in counts) rows = S.leads.filter((l) => l.status === filter).sort((a, b) => b.updated_at - a.updated_at);
    else throw new HttpError(400, 'Filtro inválido.');
    return ok({ store: { name: STORE.name }, counts: { ...counts, open: counts.new + counts.contacted }, leads: rows.map(leadView) });
  }],

  ['PATCH', /^\/store\/leads\/(\d+)$/, ({ headers, params, body: b }) => {
    storeGuard(headers);
    const lead = S.leads.find((l) => l.id === Number(params[0]));
    if (!lead) throw new HttpError(404, 'Pedido não encontrado.');
    if (b.status !== undefined) lead.status = oneOf(b.status, 'status', ['new', 'contacted', 'sold', 'closed'], 'o status');
    if (b.note !== undefined) lead.note = text(b.note, 'note', 'a anotação', { min: 0, max: 300 });
    lead.updated_at = now();
    return ok({ lead: leadView(lead) });
  }],

  ['POST', /^\/store\/test-whatsapp$/, ({ headers }) => {
    storeGuard(headers);
    mail('whatsapp', { to: STORE.whatsapp, title: 'Mensagem de teste', body: `✅ Teste do PetLee: o aviso de ração acabando chegará neste número (${STORE.name}).` });
    return ok({ ok: true, provider: 'simulado' });
  }],
];

// Rotas dos módulos comerciais (clube, vitrine, pedidos, pontos, agenda, painel): as mesmas tabelas do servidor.
const toRegex = (path) => new RegExp(`^${path.replace(/:(\w+)/g, '(?<$1>[^/]+)')}$`);
const FEATURES = [
  ...tutorRoutes.map(([m, path, fn]) => [m, toRegex(path), fn, 'tutor']),
  ...storeFeatureRoutes.map(([m, path, fn]) => [m, toRegex(`/store${path}`), fn, 'store']),
];

function runFeature(fn, kind, { params, query, body, headers }) {
  const repo = memoryRepo(S);
  const customer = kind === 'tutor' ? authed(headers).customer : (storeGuard(headers), undefined);
  const out = fn({ repo, customer, body, query, params, now: now(), settings: settingsOf(repo), hooks, store: { name: STORE.name, whatsapp: STORE.whatsapp } });
  return out && 'status' in out && Object.keys(out).every((k) => k === 'status' || k === 'body') ? out : { status: 200, body: out };
}

/** Processa uma chamada da API e devolve { status, body }. */
export function handle(method, path, query, body, headers) {
  load();
  try {
    for (const [m, re, fn] of ROUTES) {
      const match = m === method && re.exec(path);
      if (!match) continue;
      const result = fn({ params: match.slice(1), query, body: body ?? {}, headers, auth: () => authed(headers) });
      save();
      return result;
    }
    for (const [m, re, fn, kind] of FEATURES) {
      const match = m === method && re.exec(path);
      if (!match) continue;
      const result = runFeature(fn, kind, { params: { ...match.groups }, query, body: body ?? {}, headers });
      save();
      return result;
    }
    return { status: 404, body: { error: 'Rota não encontrada.' } };
  } catch (err) {
    if (err instanceof HttpError) return { status: err.status, body: { error: err.message, field: err.field } };
    console.error(err);
    return { status: 500, body: { error: 'Algo deu errado do nosso lado. Tente novamente.' } };
  }
}

// ---------- login social simulado ----------
export function socialLogin(provider) {
  load();
  const accounts = {
    google: { name: 'Ana Souza', email: 'ana@gmail.com' },
    facebook: { name: 'Caio Lima', email: 'caio@outlook.com' },
  };
  const a = accounts[provider];
  let c = S.customers.find((x) => x.email === a.email);
  if (!c) {
    c = { id: nextId('customer'), name: a.name, email: a.email, created_at: now(), [`${provider}_id`]: `${provider}-demo` };
    S.customers.push(c);
  } else c[`${provider}_id`] = `${provider}-demo`;
  const code = randomToken();
  S.codes[code] = c.id;
  save();
  return code;
}

// ---------- cenários prontos ----------
const LS_KEYS = ['apppet.token', 'petlee.onboarded', 'petlee.storekey', 'petlee.preview.push'];

function maria() {
  const at = now() - 60 * DAY_MS;
  const c = { id: nextId('customer'), name: 'Maria Silva', email: DEMO_LOGIN.email, whatsapp: '5511999998888', consent_at: at, pw: fakeHash(DEMO_LOGIN.password), created_at: at };
  S.customers.push(c);
  return c;
}

/** Maria com Thor e Mia e compras na loja. Os avisos de ração saem como sairiam de verdade. */
function mariaWithPets(c, thorDays, miaDays) {
  const { thor, mia } = seedDemoTutor(memoryRepo(S), c.id, now(), { thorDays, miaDays });
  for (const id of [thor.id, mia.id]) {
    const pet = S.pets.find((p) => p.id === id);
    pet.alert_state = 'ok';
    evaluatePet(pet);
  }
}

/** Zera o estado e monta o cenário pedido. Devolve a rota inicial sugerida (ou undefined). */
export function applyScenario(name) {
  if (name === 'keep' || !name) {
    load();
    return undefined;
  }
  S = blank();
  // a loja de exemplo (catálogo, clientes, pedidos, agenda) existe em todos os cenários, para o painel
  const repo = memoryRepo(S);
  seedStore(repo, now());
  seedCustomers(repo, now());
  const ls = localStorage;
  const set = (k, v) => { try { ls.setItem(k, v); } catch { /* ok */ } };
  try { LS_KEYS.forEach((k) => ls.removeItem(k)); } catch { /* ok */ }
  let hash = '#/';

  if (name === 'zero') {
    // conta nova: boas-vindas, sem nada cadastrado
  } else if (name === 'login') {
    mariaWithPets(maria(), 21, 20);
    set('petlee.onboarded', '1');
    hash = '#/entrar';
  } else if (name === 'social') {
    const c = { id: nextId('customer'), name: 'Ana Souza', email: 'ana@gmail.com', created_at: now(), google_id: 'google-demo' };
    S.customers.push(c);
    const code = randomToken();
    S.codes[code] = c.id;
    set('petlee.onboarded', '1');
    hash = `#/oauth?code=${code}`;
  } else {
    const c = maria();
    set('petlee.onboarded', '1');
    set('apppet.token', startSession(c.id));
    if (name !== 'logado-vazio') mariaWithPets(c, name === 'acabou' ? 0 : 21, name === 'acabando' ? 3 : 20);
  }
  save();
  return hash;
}

export function resetAll() {
  S = blank();
  try { [...LS_KEYS, KEY].forEach((k) => localStorage.removeItem(k)); } catch { /* ok */ }
}
