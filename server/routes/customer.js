import { Router } from 'express';
import { findBreed } from '../data/breeds.js';
import { MAX_MEALS, TIME_PATTERN, defaultTimes } from '../lib/feeding.js';
import { DAY_MS } from '../lib/nutrition.js';
import { normalizeWhatsApp } from '../lib/phone.js';
import { recommendationFor, resolveDailyGrams, serializePet } from '../lib/pet-model.js';
import { currentStockG } from '../lib/stock.js';
import { HttpError, bool, email, number, oneOf, text } from '../lib/validate.js';
import { customerAuth } from '../middleware.js';
import { publicCustomer } from '../services/auth.js';

const MONTH_MS = DAY_MS * 30.4375;
const MAX_PETS = 10;
const DEFAULT_ALERT_DAYS = 7;

export function customerRoutes({ db, alerts, now }) {
  const router = Router();
  const auth = customerAuth(db);
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
    // Quem entrou com Google/Facebook ainda não deu o aceite de contato da loja.
    if (!req.customer.consent_at && b.consent !== true) {
      throw new HttpError(400, 'Para avisar você e a loja, precisamos da sua autorização.', 'consent');
    }
    const clash = db.prepare('SELECT 1 FROM customers WHERE whatsapp = ? AND id <> ?').get(whatsapp, req.customer.id);
    if (clash) throw new HttpError(409, 'Este WhatsApp já está em uso em outro cadastro.', 'whatsapp');
    db.prepare('UPDATE customers SET name = ?, whatsapp = ?, consent_at = COALESCE(consent_at, ?) WHERE id = ?').run(name, whatsapp, now(), req.customer.id);
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

    // Rotina: quantas vezes e a que horas o tutor costuma alimentar (padrão = sugestão para a raça).
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
    if (!req.customer.whatsapp || !req.customer.consent_at) {
      throw new HttpError(403, 'Complete seu cadastro (WhatsApp e autorização) antes de adicionar um pet.', 'profile');
    }
    if (petsOf(req.customer.id).length >= MAX_PETS) throw new HttpError(400, `Limite de ${MAX_PETS} pets por cadastro.`);
    const pet = parsePet(req.body ?? {}, at);
    const stockKg = number(req.body.stockKg ?? req.body.monthlyPurchaseKg, 'stockKg', 'quanto tem de ração em casa', { min: 0, max: 200 });

    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO pets (customer_id, name, species, breed_id, breed_name, adult_kg, color, birth_at, weight_kg, neutered,
                           kcal_per_kg, meals_per_day, meal_times, monthly_purchase_g, daily_mode, daily_g, stock_g, stock_at, alert_days, created_at)
         VALUES (@customer_id, @name, @species, @breed_id, @breed_name, @adult_kg, @color, @birth_at, @weight_kg, @neutered,
                 @kcal_per_kg, @meals_per_day, @meal_times, @monthly_purchase_g, @daily_mode, @daily_g, @stock_g, @stock_at, @alert_days, @created_at)`,
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
                       meals_per_day=@meals_per_day, meal_times=@meal_times, monthly_purchase_g=@monthly_purchase_g, daily_mode=@daily_mode, daily_g=@daily_g,
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
