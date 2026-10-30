import crypto from 'node:crypto';
import { Router } from 'express';
import { findBreed } from '../data/breeds.js';
import { DAY_MS } from '../lib/nutrition.js';
import { normalizeWhatsApp } from '../lib/phone.js';
import { recommendationFor, resolveDailyGrams, serializePet } from '../lib/pet-model.js';
import { currentStockG } from '../lib/stock.js';
import { HttpError, bool, email, number, oneOf, text } from '../lib/validate.js';
import { customerAuth, rateLimit, sha256 } from '../middleware.js';

const MONTH_MS = DAY_MS * 30.4375;
const MAX_PETS = 10;
const DEFAULT_ALERT_DAYS = 7;

const publicCustomer = (c) => ({ id: c.id, name: c.name, email: c.email, whatsapp: c.whatsapp });

export function customerRoutes({ db, alerts, now }) {
  const router = Router();
  const auth = customerAuth(db);
  const authLimit = rateLimit({ windowMs: 10 * 60_000, max: 20 });

  function startSession(customerId) {
    const token = crypto.randomBytes(32).toString('base64url');
    db.prepare('INSERT INTO sessions (token_hash, customer_id, created_at) VALUES (?, ?, ?)').run(sha256(token), customerId, now());
    return token;
  }

  // ---------- cadastro e login ----------

  router.post('/customers', authLimit, (req, res) => {
    const b = req.body ?? {};
    const name = text(b.name, 'name', 'seu nome', { min: 2, max: 80 });
    const mail = email(b.email);
    const whatsapp = normalizeWhatsApp(b.whatsapp);
    if (!whatsapp) throw new HttpError(400, 'Informe um WhatsApp válido com DDD, ex.: (11) 99999-8888.', 'whatsapp');
    if (b.consent !== true) {
      throw new HttpError(400, 'Para avisar você e a loja, precisamos da sua autorização.', 'consent');
    }

    const clash = db.prepare('SELECT email, whatsapp FROM customers WHERE email = ? OR whatsapp = ?').get(mail, whatsapp);
    if (clash) {
      const field = clash.email === mail ? 'e-mail' : 'WhatsApp';
      throw new HttpError(409, `Já existe um cadastro com este ${field}. Toque em "Já tenho cadastro" para entrar.`, field === 'e-mail' ? 'email' : 'whatsapp');
    }

    const at = now();
    const { lastInsertRowid } = db
      .prepare('INSERT INTO customers (name, email, whatsapp, consent_at, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(name, mail, whatsapp, at, at);
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(lastInsertRowid);
    res.status(201).json({ token: startSession(customer.id), customer: publicCustomer(customer) });
  });

  router.post('/session', authLimit, (req, res) => {
    const mail = email(req.body?.email);
    const whatsapp = normalizeWhatsApp(req.body?.whatsapp);
    const customer = whatsapp && db.prepare('SELECT * FROM customers WHERE email = ? AND whatsapp = ?').get(mail, whatsapp);
    if (!customer) throw new HttpError(401, 'Não encontramos um cadastro com esse e-mail e WhatsApp.');
    res.json({ token: startSession(customer.id), customer: publicCustomer(customer) });
  });

  router.delete('/session', auth, (req, res) => {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(req.tokenHash);
    res.status(204).end();
  });

  // ---------- perfil ----------

  const petsOf = (customerId) => db.prepare('SELECT * FROM pets WHERE customer_id = ? ORDER BY id').all(customerId);

  router.get('/me', auth, (req, res) => {
    const at = now();
    const unread = db.prepare('SELECT COUNT(*) n FROM alerts WHERE customer_id = ? AND read_at IS NULL').get(req.customer.id).n;
    res.json({ customer: publicCustomer(req.customer), pets: petsOf(req.customer.id).map((p) => serializePet(p, at)), unreadAlerts: unread });
  });

  router.patch('/me', auth, (req, res) => {
    const b = req.body ?? {};
    const name = text(b.name, 'name', 'seu nome', { min: 2, max: 80 });
    const whatsapp = normalizeWhatsApp(b.whatsapp);
    if (!whatsapp) throw new HttpError(400, 'Informe um WhatsApp válido com DDD, ex.: (11) 99999-8888.', 'whatsapp');
    const clash = db.prepare('SELECT 1 FROM customers WHERE whatsapp = ? AND id <> ?').get(whatsapp, req.customer.id);
    if (clash) throw new HttpError(409, 'Este WhatsApp já está em uso em outro cadastro.', 'whatsapp');
    db.prepare('UPDATE customers SET name = ?, whatsapp = ? WHERE id = ?').run(name, whatsapp, req.customer.id);
    res.json({ customer: publicCustomer(db.prepare('SELECT * FROM customers WHERE id = ?').get(req.customer.id)) });
  });

  // Direito de exclusão (LGPD): apaga o cadastro e tudo que depende dele.
  router.delete('/me', auth, (req, res) => {
    db.prepare('DELETE FROM customers WHERE id = ?').run(req.customer.id);
    res.status(204).end();
  });

  // ---------- pets ----------

  function parsePet(body, at, current) {
    const species = oneOf(body.species, 'species', ['dog', 'cat'], 'cão ou gato');
    const breed = findBreed(body.breedId);
    if (!breed || breed.species !== species) throw new HttpError(400, 'Escolha a raça do pet.', 'breedId');

    const years = number(body.ageYears ?? 0, 'ageYears', 'a idade em anos', { min: 0, max: 30 });
    const months = number(body.ageMonths ?? 0, 'ageMonths', 'a idade em meses', { min: 0, max: 11 });
    const ageMonths = Math.round(years) * 12 + Math.round(months);

    const currentAge = current ? Math.floor((at - current.birth_at) / MONTH_MS) : null;
    // Ao editar sem mexer na idade, mantém a data de nascimento original.
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
      alert_days: Math.round(number(body.alertDays ?? DEFAULT_ALERT_DAYS, 'alertDays', 'os dias de antecedência', { min: 1, max: 30 })),
    };

    const customGrams = mode === 'custom' ? number(body.customDailyGrams, 'customDailyGrams', 'quantos gramas por dia', { min: 5, max: 5000 }) : null;
    pet.daily_g = resolveDailyGrams({
      mode,
      customGrams,
      monthlyPurchaseGrams: pet.monthly_purchase_g,
      recommendedGrams: recommendationFor(pet, at).dailyGrams,
    });
    return pet;
  }

  function ownedPet(req) {
    const pet = db.prepare('SELECT * FROM pets WHERE id = ? AND customer_id = ?').get(Number(req.params.id), req.customer.id);
    if (!pet) throw new HttpError(404, 'Pet não encontrado.');
    return pet;
  }

  const reload = (id) => db.prepare('SELECT * FROM pets WHERE id = ?').get(id);

  /** Avalia o alerta logo após qualquer mudança e devolve o pet atualizado. */
  function respond(res, petId, status = 200) {
    const at = now();
    alerts.evaluatePet(reload(petId), at);
    res.status(status).json({ pet: serializePet(reload(petId), at) });
    alerts.flushOutbox().catch(() => {});
  }

  router.post('/pets', auth, (req, res) => {
    const at = now();
    if (petsOf(req.customer.id).length >= MAX_PETS) throw new HttpError(400, `Limite de ${MAX_PETS} pets por cadastro.`);
    const pet = parsePet(req.body ?? {}, at);
    const stockKg = number(req.body.stockKg ?? req.body.monthlyPurchaseKg, 'stockKg', 'quanto tem de ração em casa', { min: 0, max: 200 });

    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO pets (customer_id, name, species, breed_id, breed_name, adult_kg, color, birth_at, weight_kg, neutered,
                           kcal_per_kg, monthly_purchase_g, daily_mode, daily_g, stock_g, stock_at, alert_days, created_at)
         VALUES (@customer_id, @name, @species, @breed_id, @breed_name, @adult_kg, @color, @birth_at, @weight_kg, @neutered,
                 @kcal_per_kg, @monthly_purchase_g, @daily_mode, @daily_g, @stock_g, @stock_at, @alert_days, @created_at)`,
      )
      .run({ ...pet, customer_id: req.customer.id, stock_g: stockKg * 1000, stock_at: at, created_at: at });
    respond(res, lastInsertRowid, 201);
  });

  router.get('/pets/:id', auth, (req, res) => res.json({ pet: serializePet(ownedPet(req), now()) }));

  router.patch('/pets/:id', auth, (req, res) => {
    const current = ownedPet(req);
    const at = now();
    const pet = parsePet(req.body ?? {}, at, current);
    // Fixa o estoque de agora antes de mudar o consumo, para não reescrever o passado.
    const stockG = req.body.stockKg === undefined ? currentStockG(current, at) : number(req.body.stockKg, 'stockKg', 'o estoque', { min: 0, max: 200 }) * 1000;

    db.prepare(
      `UPDATE pets SET name=@name, species=@species, breed_id=@breed_id, breed_name=@breed_name, adult_kg=@adult_kg, color=@color,
                       birth_at=@birth_at, weight_kg=@weight_kg, neutered=@neutered, kcal_per_kg=@kcal_per_kg,
                       monthly_purchase_g=@monthly_purchase_g, daily_mode=@daily_mode, daily_g=@daily_g,
                       alert_days=@alert_days, stock_g=@stock_g, stock_at=@stock_at
       WHERE id=@id`,
    ).run({ ...pet, id: current.id, stock_g: stockG, stock_at: at });
    respond(res, current.id);
  });

  router.delete('/pets/:id', auth, (req, res) => {
    db.prepare('DELETE FROM pets WHERE id = ?').run(ownedPet(req).id);
    res.status(204).end();
  });

  // "Comprei ração": soma ao que ainda resta em casa.
  router.post('/pets/:id/restock', auth, (req, res) => {
    const pet = ownedPet(req);
    const at = now();
    const addKg = number(req.body?.kg ?? pet.monthly_purchase_g / 1000, 'kg', 'a quantidade comprada', { min: 0.1, max: 200 });
    db.prepare('UPDATE pets SET stock_g = ?, stock_at = ? WHERE id = ?').run(currentStockG(pet, at) + addKg * 1000, at, pet.id);
    respond(res, pet.id);
  });

  // "Ajustar estoque": o tutor pesou/olhou o saco e informa quanto realmente tem.
  router.post('/pets/:id/stock', auth, (req, res) => {
    const pet = ownedPet(req);
    const kg = number(req.body?.kg, 'kg', 'quanto tem de ração em casa', { min: 0, max: 200 });
    db.prepare('UPDATE pets SET stock_g = ?, stock_at = ? WHERE id = ?').run(kg * 1000, now(), pet.id);
    respond(res, pet.id);
  });

  // ---------- avisos dentro do app ----------

  router.get('/alerts', auth, (req, res) => {
    const rows = db
      .prepare('SELECT id, pet_id, kind, title, body, created_at, read_at FROM alerts WHERE customer_id = ? ORDER BY id DESC LIMIT 50')
      .all(req.customer.id);
    res.json({
      alerts: rows.map((a) => ({
        id: a.id,
        petId: a.pet_id,
        kind: a.kind,
        title: a.title,
        body: a.body,
        createdAt: new Date(a.created_at).toISOString(),
        read: a.read_at !== null,
      })),
    });
  });

  router.post('/alerts/read', auth, (req, res) => {
    db.prepare('UPDATE alerts SET read_at = ? WHERE customer_id = ? AND read_at IS NULL').run(now(), req.customer.id);
    res.status(204).end();
  });

  // ---------- push ----------

  router.post('/push/subscribe', auth, (req, res) => {
    const { endpoint, keys } = req.body ?? {};
    if (typeof endpoint !== 'string' || !/^https:\/\//.test(endpoint) || endpoint.length > 1000 || !keys?.p256dh || !keys?.auth) {
      throw new HttpError(400, 'Inscrição de notificação inválida.');
    }
    db.prepare(
      `INSERT INTO push_subscriptions (customer_id, endpoint, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET customer_id = excluded.customer_id, p256dh = excluded.p256dh, auth = excluded.auth`,
    ).run(req.customer.id, endpoint, String(keys.p256dh), String(keys.auth), now());
    res.status(204).end();
  });

  router.post('/push/unsubscribe', auth, (req, res) => {
    db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND customer_id = ?').run(String(req.body?.endpoint ?? ''), req.customer.id);
    res.status(204).end();
  });

  return router;
}
