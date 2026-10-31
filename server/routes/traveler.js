/**
 * API do viajante (PRD §4). O viajante só enxerga viagens publicadas às quais foi associado,
 * só documentos marcados como visíveis e só lugares aprovados. Não edita dados da viagem:
 * marca tarefas, salva favoritos e ajusta as próprias preferências.
 */
import { Router } from 'express';
import { HttpError, requireUser, sendFile } from '../http.js';
import { newId, hmac, safeEqual } from '../lib/ids.js';
import { daysBetween, nowIso, todayIn } from '../lib/time.js';
import { destinationName, guessImageMime } from './admin-content.js';
import { NOTIFICATION_PREFS, userPrefs } from '../services/notifications.js';

const EVENT_NAMES = new Set([
  'view_home',
  'view_itinerary',
  'view_tasks',
  'view_documents',
  'open_document',
  'view_guide',
  'view_place',
  'open_map',
  'whatsapp_click',
]);

const label = (list, key) => list.find((x) => x.key === key)?.label || key;

export const mapsUrl = (address) => (address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : null);

function distanceKm(a, b) {
  const R = 6371;
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 10) / 10;
}

/** Link do WhatsApp com mensagem contextual. Número vem do painel, nunca do código. */
export function whatsappLink(settings, { user, trip, destination }) {
  const number = settings.whatsapp_number;
  if (!number) return null;
  const text = settings.whatsapp_message
    .replaceAll('{nome}', user?.name || '')
    .replaceAll('{viagem}', trip?.name || '')
    .replaceAll('{codigo}', trip?.id || '')
    .replaceAll('{destino}', destination || '')
    .replace(/\s+\(\)/g, '')
    .trim();
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export function travelerRoutes(services) {
  const { db, settings, config, storage } = services;
  const now = () => (services.now ? services.now() : Date.now());
  const r = Router();

  const myTrips = (userId) =>
    db
      .prepare(
        `SELECT t.id, t.name, t.start_date, t.end_date, t.timezone, t.cover_image_url, t.destination_id, tt.traveler_role
         FROM trips t JOIN trip_travelers tt ON tt.trip_id = t.id
         WHERE tt.user_id = ? AND tt.invitation_status != 'revoked' AND t.status = 'published'
         ORDER BY t.start_date`,
      )
      .all(userId);

  /** Confere o acesso à viagem. Admin pode ver qualquer viagem (modo pré-visualização). */
  function tripAccess(req, _res, next) {
    const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(req.params.tripId);
    const isAdmin = req.user.role === 'admin';
    const member = trip
      ? db.prepare("SELECT * FROM trip_travelers WHERE trip_id = ? AND user_id = ? AND invitation_status != 'revoked'").get(trip.id, req.user.id)
      : null;
    if (!trip || (!isAdmin && (!member || trip.status !== 'published'))) throw new HttpError(404, 'Viagem não encontrada.');
    req.trip = trip;
    req.member = member;
    next();
  }

  const canSeeDocument = (user, doc) => {
    if (user.role === 'admin') return true;
    if (!doc.visible_to_traveler) return false;
    return !!db
      .prepare(
        `SELECT 1 FROM trip_travelers tt JOIN trips t ON t.id = tt.trip_id
         WHERE tt.trip_id = ? AND tt.user_id = ? AND tt.invitation_status != 'revoked' AND t.status = 'published'`,
      )
      .get(doc.trip_id, user.id);
  };

  const destinationOf = (trip) => db.prepare('SELECT * FROM destinations WHERE id = ?').get(trip.destination_id);

  function tasksFor(trip, userId) {
    const tasks = db
      .prepare(
        `SELECT t.id, t.title, t.description, t.due_date, t.priority, t.official_url, t.source, c.completed_at
         FROM tasks t LEFT JOIN task_completions c ON c.task_id = t.id AND c.user_id = ?
         WHERE t.trip_id = ? AND t.active = 1`,
      )
      .all(userId, trip.id);
    const today = todayIn(trip.timezone, now());
    const prio = { alta: 0, media: 1, baixa: 2 };
    return tasks
      .map((t) => ({
        ...t,
        done: !!t.completed_at,
        days_left: t.due_date ? daysBetween(today, t.due_date) : null,
        overdue: !t.completed_at && t.due_date ? t.due_date < today : false,
      }))
      .sort((a, b) => (a.done - b.done) || ((a.due_date ?? '0000') < (b.due_date ?? '0000') ? -1 : (a.due_date ?? '0000') > (b.due_date ?? '0000') ? 1 : 0) || prio[a.priority] - prio[b.priority]);
  }

  r.use(requireUser);

  // ------------------------------------------------------------- perfil
  r.get('/me', (req, res) => {
    const u = req.user;
    res.json({
      user: { id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, preferences: JSON.parse(u.preferences || '{}') },
      notification_prefs: userPrefs(u),
      notification_pref_labels: Object.fromEntries(Object.entries(NOTIFICATION_PREFS).map(([k, v]) => [k, v.label])),
      trips: myTrips(u.id).map((t) => ({ ...t, destination_name: destinationName(destinationOf(t)) })),
      options: settings.publicView(),
    });
  });

  /** Só dados pessoais mínimos e preferências opcionais (PRD §4.1). */
  r.patch('/me', (req, res) => {
    const u = req.user;
    const { name, phone, preferences, notification_prefs } = req.body || {};
    const s = settings.all();
    const updates = {};
    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim() || name.length > 120) throw new HttpError(422, 'Informe seu nome (até 120 caracteres).');
      updates.name = name.trim();
    }
    if (phone !== undefined) {
      const digits = String(phone || '').replace(/\D/g, '');
      if (digits && (digits.length < 8 || digits.length > 15)) throw new HttpError(422, 'Telefone inválido.');
      updates.phone = digits || null;
    }
    if (preferences !== undefined) {
      const interestKeys = new Set(s.interests.map((i) => i.key));
      const p = preferences || {};
      const clean = {
        interests: Array.isArray(p.interests) ? p.interests.filter((k) => interestKeys.has(k)) : [],
        restrictions: typeof p.restrictions === 'string' ? p.restrictions.slice(0, 500) : '',
        group: typeof p.group === 'string' ? p.group.slice(0, 200) : '',
        // Avatar = uma das carinhas da marca (face-1 … face-18).
        avatar: typeof p.avatar === 'string' && /^face-([1-9]|1[0-8])$/.test(p.avatar) ? p.avatar : '',
      };
      updates.preferences = JSON.stringify(clean);
    }
    if (notification_prefs !== undefined) {
      const cur = userPrefs(u);
      for (const k of Object.keys(NOTIFICATION_PREFS)) if (typeof notification_prefs?.[k] === 'boolean') cur[k] = notification_prefs[k];
      updates.notification_prefs = JSON.stringify(cur);
    }
    if (Object.keys(updates).length) {
      db.prepare(`UPDATE users SET ${Object.keys(updates).map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`).run(
        ...Object.values(updates),
        nowIso(now()),
        u.id,
      );
    }
    res.json({ ok: true });
  });

  /** LGPD: o titular baixa os próprios dados. */
  r.get('/me/export', (req, res) => {
    const u = req.user;
    const data = {
      exported_at: nowIso(now()),
      user: { name: u.name, email: u.email, phone: u.phone, nationality: u.nationality, preferences: JSON.parse(u.preferences || '{}'), created_at: u.created_at },
      trips: myTrips(u.id).map((t) => ({ id: t.id, name: t.name, start_date: t.start_date, end_date: t.end_date })),
      favorites: db.prepare('SELECT p.name, f.created_at FROM favorites f JOIN places p ON p.id = f.place_id WHERE f.user_id = ?').all(u.id),
      completed_tasks: db
        .prepare('SELECT t.title, c.completed_at FROM task_completions c JOIN tasks t ON t.id = c.task_id WHERE c.user_id = ?')
        .all(u.id),
      notifications: db.prepare('SELECT title, created_at, read_at FROM notifications WHERE user_id = ?').all(u.id),
    };
    sendFile(res, { buffer: Buffer.from(JSON.stringify(data, null, 2)), fileName: 'meus-dados-vagari.json', mime: 'application/json', inline: false });
  });

  r.post('/me/privacy-requests', (req, res) => {
    const kind = req.body?.kind;
    if (!['access', 'correction', 'deletion', 'other'].includes(kind)) throw new HttpError(422, 'kind deve ser access, correction, deletion ou other.');
    const id = newId('prv_');
    db.prepare('INSERT INTO privacy_requests (id, user_id, kind, message, created_at) VALUES (?, ?, ?, ?, ?)').run(
      id,
      req.user.id,
      kind,
      String(req.body?.message || '').slice(0, 2000),
      nowIso(now()),
    );
    res.status(201).json({ id, message: 'Recebemos seu pedido. A Vagari responderá pelo seu e-mail.' });
  });

  r.get('/trips', (req, res) => {
    res.json({ trips: myTrips(req.user.id).map((t) => ({ ...t, destination_name: destinationName(destinationOf(t)) })) });
  });

  // ------------------------------------------------------------- início
  r.get('/trips/:tripId', tripAccess, (req, res) => {
    const trip = req.trip;
    const s = settings.all();
    const dest = destinationOf(trip);
    const today = todayIn(trip.timezone, now());
    const toStart = daysBetween(today, trip.start_date);
    const phase = toStart > 0 ? 'before' : today <= trip.end_date ? 'during' : 'after';
    const flights = db.prepare('SELECT * FROM flight_segments WHERE trip_id = ? ORDER BY departure_at').all(trip.id);
    const accommodations = db.prepare('SELECT * FROM accommodations WHERE trip_id = ? ORDER BY checkin_at').all(trip.id);
    const nextFlight = flights.find((f) => f.departure_at.slice(0, 10) >= today) || null;
    const stay =
      accommodations.find((a) => a.checkin_at.slice(0, 10) <= today && a.checkout_at.slice(0, 10) > today) ||
      accommodations.find((a) => a.checkin_at.slice(0, 10) >= today) ||
      null;
    const upcoming = db
      .prepare('SELECT id, date, start_time, end_time, title, category, address FROM itinerary_items WHERE trip_id = ? AND date >= ? ORDER BY date, start_time LIMIT 3')
      .all(trip.id, today)
      .map((i) => ({ ...i, category_label: label(s.itinerary_categories, i.category), maps_url: mapsUrl(i.address) }));
    const tasks = tasksFor(trip, req.user.id);
    const done = tasks.filter((t) => t.done).length;
    res.json({
      trip: {
        id: trip.id,
        name: trip.name,
        start_date: trip.start_date,
        end_date: trip.end_date,
        timezone: trip.timezone,
        cover_image_url: trip.cover_image_url,
        general_notes: trip.general_notes,
        destination: dest ? { id: dest.id, name: destinationName(dest), country: dest.country } : null,
        preview: trip.status !== 'published',
      },
      countdown: { days_to_start: Math.max(toStart, 0), phase, day_number: phase === 'during' ? daysBetween(trip.start_date, today) + 1 : null, total_days: daysBetween(trip.start_date, trip.end_date) + 1 },
      next_flight: nextFlight,
      accommodation: stay ? { ...stay, maps_url: mapsUrl(stay.address) } : null,
      upcoming,
      progress: { done, total: tasks.length, percent: tasks.length ? Math.round((done / tasks.length) * 100) : 100 },
      next_task: tasks.find((t) => !t.done) || null,
      announcements: db.prepare('SELECT id, title, body, essential, created_at FROM announcements WHERE trip_id = ? ORDER BY created_at DESC LIMIT 5').all(trip.id),
      help: {
        whatsapp_url: whatsappLink(s, { user: req.user, trip, destination: destinationName(dest) }),
        support_24h: s.support_24h,
        support_hours_text: s.support_24h ? 'Atendimento 24 horas' : s.support_hours_text,
      },
      other_trips: myTrips(req.user.id).filter((t) => t.id !== trip.id).map((t) => ({ id: t.id, name: t.name, start_date: t.start_date })),
    });
  });

  // ------------------------------------------------------------- roteiro por dia
  r.get('/trips/:tripId/itinerary', tripAccess, (req, res) => {
    const trip = req.trip;
    const s = settings.all();
    const days = new Map();
    const push = (date, item) => {
      if (!days.has(date)) days.set(date, []);
      days.get(date).push(item);
    };
    for (const f of db.prepare('SELECT * FROM flight_segments WHERE trip_id = ?').all(trip.id)) {
      push(f.departure_at.slice(0, 10), {
        type: 'flight',
        id: f.id,
        time: f.departure_at.slice(11, 16) || null,
        title: `Voo ${f.flight_number} · ${f.departure_airport} → ${f.arrival_airport}`,
        airline: f.airline,
        departure_at: f.departure_at,
        arrival_at: f.arrival_at,
        booking_reference: f.booking_reference,
        notes: f.notes,
      });
    }
    for (const a of db.prepare('SELECT * FROM accommodations WHERE trip_id = ?').all(trip.id)) {
      const base = { id: a.id, title: a.name, address: a.address, maps_url: mapsUrl(a.address), confirmation_code: a.confirmation_code, notes: a.notes };
      push(a.checkin_at.slice(0, 10), { ...base, type: 'checkin', time: a.checkin_at.slice(11, 16) || null });
      push(a.checkout_at.slice(0, 10), { ...base, type: 'checkout', time: a.checkout_at.slice(11, 16) || null });
    }
    for (const i of db.prepare('SELECT * FROM itinerary_items WHERE trip_id = ?').all(trip.id)) {
      push(i.date, {
        type: 'activity',
        id: i.id,
        time: i.start_time,
        end_time: i.end_time,
        title: i.title,
        category: i.category,
        category_label: label(s.itinerary_categories, i.category),
        address: i.address,
        maps_url: mapsUrl(i.address),
        description: i.description,
        booking_status: i.booking_status,
        booking_status_label: i.booking_status ? label(s.booking_statuses, i.booking_status) : null,
        confirmation_code: i.confirmation_code,
        external_url: i.external_url,
      });
    }
    // Todos os dias da viagem aparecem, mesmo sem atividades (dia livre).
    for (let d = trip.start_date; d <= trip.end_date; d = new Date(Date.parse(d) + 86_400_000).toISOString().slice(0, 10)) if (!days.has(d)) days.set(d, []);
    const today = todayIn(trip.timezone, now());
    const out = [...days.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, items]) => ({
        date,
        day_number: date >= trip.start_date && date <= trip.end_date ? daysBetween(trip.start_date, date) + 1 : null,
        is_today: date === today,
        items: items.sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99')),
      }));
    res.json({ timezone: trip.timezone, days: out });
  });

  // ------------------------------------------------------------- jornada de preparação
  r.get('/trips/:tripId/tasks', tripAccess, (req, res) => {
    const tasks = tasksFor(req.trip, req.user.id);
    const done = tasks.filter((t) => t.done).length;
    res.json({ tasks, progress: { done, total: tasks.length, percent: tasks.length ? Math.round((done / tasks.length) * 100) : 100 } });
  });

  const memberTask = (req) => {
    if (!req.member) throw new HttpError(403, 'Só viajantes da viagem marcam tarefas.');
    const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND trip_id = ? AND active = 1').get(req.params.taskId, req.trip.id);
    if (!task) throw new HttpError(404, 'Tarefa não encontrada.');
    return task;
  };

  r.post('/trips/:tripId/tasks/:taskId/complete', tripAccess, (req, res) => {
    const task = memberTask(req);
    db.prepare('INSERT OR IGNORE INTO task_completions (task_id, user_id, completed_at) VALUES (?, ?, ?)').run(task.id, req.user.id, nowIso(now()));
    res.json({ ok: true });
  });

  r.delete('/trips/:tripId/tasks/:taskId/complete', tripAccess, (req, res) => {
    const task = memberTask(req);
    db.prepare('DELETE FROM task_completions WHERE task_id = ? AND user_id = ?').run(task.id, req.user.id);
    res.json({ ok: true });
  });

  // ------------------------------------------------------------- documentos
  r.get('/trips/:tripId/documents', tripAccess, (req, res) => {
    const s = settings.all();
    const docs = db
      .prepare(
        `SELECT id, category, title, stage, mime_type, size_bytes, version, notes, updated_at, external_url IS NOT NULL is_link
         FROM documents WHERE trip_id = ? AND visible_to_traveler = 1 ORDER BY category, title`,
      )
      .all(req.trip.id)
      .map((d) => ({
        ...d,
        is_link: !!d.is_link,
        category_label: label(s.document_categories, d.category),
        stage_label: d.stage ? label(s.document_stages, d.stage) : null,
        url: `/api/trips/${encodeURIComponent(req.trip.id)}/documents/${d.id}/file`,
      }));
    const groups = s.document_categories
      .map((c) => ({ category: c.key, label: c.label, documents: docs.filter((d) => d.category === c.key) }))
      .filter((g) => g.documents.length);
    res.json({ documents: docs, groups });
  });

  const getVisibleDoc = (req) => {
    const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND trip_id = ?').get(req.params.docId, req.trip.id);
    if (!doc || !canSeeDocument(req.user, doc)) throw new HttpError(404, 'Documento não encontrado.');
    return doc;
  };

  const streamDoc = (res, doc) => {
    if (doc.external_url) return res.redirect(doc.external_url);
    if (!doc.storage_key || !storage.exists(doc.storage_key)) throw new HttpError(404, 'Arquivo indisponível. Fale com a Vagari.');
    sendFile(res, { stream: storage.stream(doc.storage_key), fileName: doc.source_name || doc.title, mime: doc.mime_type });
  };

  r.get('/trips/:tripId/documents/:docId/file', tripAccess, (req, res) => streamDoc(res, getVisibleDoc(req)));

  /** Link assinado e temporário (5 min) — para abrir em outra aba/app ou baixar para uso offline. */
  r.post('/trips/:tripId/documents/:docId/link', tripAccess, (req, res) => {
    const doc = getVisibleDoc(req);
    const exp = Math.floor(now() / 1000) + 300;
    const sig = hmac(config.secret, `${doc.id}.${req.user.id}.${exp}`);
    res.json({ url: `/files/${doc.id}?u=${encodeURIComponent(req.user.id)}&e=${exp}&s=${sig}`, expires_at: new Date(exp * 1000).toISOString() });
  });

  // ------------------------------------------------------------- guia do destino
  /** Destinos da viagem: o destino principal, as cidades do roteiro/hospedagem e todos os "filhos" deles. */
  function tripDestinationIds(trip) {
    const roots = new Set([trip.destination_id]);
    for (const { city_id } of db.prepare('SELECT city_id FROM accommodations WHERE trip_id = ? AND city_id IS NOT NULL UNION SELECT city_id FROM itinerary_items WHERE trip_id = ? AND city_id IS NOT NULL').all(trip.id, trip.id))
      roots.add(city_id);
    const placeholders = [...roots].map(() => '?').join(',');
    return db
      .prepare(
        `WITH RECURSIVE tree(id) AS (SELECT id FROM destinations WHERE id IN (${placeholders})
         UNION SELECT d.id FROM destinations d JOIN tree ON d.parent_id = tree.id) SELECT id FROM tree`,
      )
      .all(...roots)
      .map((x) => x.id);
  }

  const coverOf = (placeId) => {
    const m = db.prepare('SELECT id, media_url, alt_text FROM place_media WHERE place_id = ? ORDER BY display_order LIMIT 1').get(placeId);
    return m ? { url: m.media_url || `/api/media/${m.id}`, alt_text: m.alt_text } : null;
  };

  const placeCard = (p, s, extra = {}) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    category_label: label(s.place_categories, p.category),
    destination_id: p.destination_id,
    short_description: p.short_description,
    address: p.address,
    maps_url: mapsUrl(p.address || (p.latitude !== null ? `${p.latitude},${p.longitude}` : null)),
    price_level: p.price_level,
    opening_hours: p.opening_hours,
    official_url: p.official_url,
    booking_url: p.booking_url,
    tags: JSON.parse(p.tags || '[]'),
    last_verified_at: p.last_verified_at,
    cover: coverOf(p.id),
    ...extra,
  });

  r.get('/trips/:tripId/guide', tripAccess, (req, res) => {
    const trip = req.trip;
    const s = settings.all();
    const { q, category, destination_id, favorites, near } = req.query;
    const ids = tripDestinationIds(trip);
    const scope = destination_id && ids.includes(destination_id) ? [destination_id] : ids;
    let sql = `SELECT p.*, tp.note highlight_note, tp.trip_id hl, f.id fav FROM places p
      LEFT JOIN trip_places tp ON tp.place_id = p.id AND tp.trip_id = ?
      LEFT JOIN favorites f ON f.place_id = p.id AND f.user_id = ?
      WHERE p.status = 'approved' AND (p.destination_id IN (${scope.map(() => '?').join(',')}) OR tp.trip_id IS NOT NULL)`;
    const args = [trip.id, req.user.id, ...scope];
    if (category) (sql += ' AND p.category = ?'), args.push(category);
    if (q) (sql += ' AND (p.name LIKE ? OR p.short_description LIKE ? OR p.tags LIKE ?)'), args.push(`%${q}%`, `%${q}%`, `%${q}%`);
    if (favorites === '1' || favorites === 'true') sql += ' AND f.id IS NOT NULL';
    const rows = db.prepare(sql).all(...args);

    // "Perto do hotel": hospedagem atual/próxima com coordenadas.
    let anchor = null;
    if (near === 'hotel') {
      const today = todayIn(trip.timezone, now());
      const accs = db.prepare('SELECT * FROM accommodations WHERE trip_id = ? AND latitude IS NOT NULL ORDER BY checkin_at').all(trip.id);
      anchor = accs.find((a) => a.checkout_at.slice(0, 10) > today) || accs[accs.length - 1] || null;
    }
    const places = rows.map((p) =>
      placeCard(p, s, {
        is_favorite: !!p.fav,
        highlight: !!p.hl,
        highlight_note: p.highlight_note,
        distance_km: anchor && p.latitude !== null ? distanceKm(anchor, p) : null,
      }),
    );
    places.sort((a, b) => {
      if (a.highlight !== b.highlight) return a.highlight ? -1 : 1;
      if (anchor) return (a.distance_km ?? 1e9) - (b.distance_km ?? 1e9);
      return a.category_label.localeCompare(b.category_label) || a.name.localeCompare(b.name);
    });
    const destinations = db
      .prepare(`SELECT * FROM destinations WHERE id IN (${ids.map(() => '?').join(',')})`)
      .all(...ids)
      .map((d) => ({ id: d.id, name: destinationName(d) }));
    const categories = s.place_categories.filter((c) => places.some((p) => p.category === c.key) || category === c.key);
    res.json({ places, categories, destinations, near_hotel: anchor ? { name: anchor.name } : null });
  });

  const getApprovedPlace = (id) => {
    const p = db.prepare("SELECT * FROM places WHERE id = ? AND status = 'approved'").get(id);
    if (!p) throw new HttpError(404, 'Lugar não encontrado.');
    return p;
  };

  r.get('/places/:placeId', (req, res) => {
    const p = getApprovedPlace(req.params.placeId);
    const s = settings.all();
    const media = db
      .prepare('SELECT id, media_url, alt_text, display_order FROM place_media WHERE place_id = ? ORDER BY display_order')
      .all(p.id)
      .map((m) => ({ url: m.media_url || `/api/media/${m.id}`, alt_text: m.alt_text }));
    const fav = db.prepare('SELECT 1 FROM favorites WHERE user_id = ? AND place_id = ?').get(req.user.id, p.id);
    res.json({ place: placeCard(p, s, { media, is_favorite: !!fav, source_url: p.source_url }) });
  });

  r.post('/places/:placeId/favorite', (req, res) => {
    const p = getApprovedPlace(req.params.placeId);
    db.prepare('INSERT OR IGNORE INTO favorites (id, user_id, place_id, created_at) VALUES (?, ?, ?, ?)').run(newId('fav_'), req.user.id, p.id, nowIso(now()));
    res.json({ ok: true, is_favorite: true });
  });

  r.delete('/places/:placeId/favorite', (req, res) => {
    db.prepare('DELETE FROM favorites WHERE user_id = ? AND place_id = ?').run(req.user.id, req.params.placeId);
    res.json({ ok: true, is_favorite: false });
  });

  r.get('/favorites', (req, res) => {
    const s = settings.all();
    const rows = db
      .prepare("SELECT p.* FROM favorites f JOIN places p ON p.id = f.place_id AND p.status = 'approved' WHERE f.user_id = ? ORDER BY f.created_at DESC")
      .all(req.user.id);
    res.json({ places: rows.map((p) => placeCard(p, s, { is_favorite: true })) });
  });

  /** Imagens: de lugares aprovados para viajantes; equipe vê qualquer uma. */
  r.get('/media/:mediaId', (req, res) => {
    const m = db.prepare('SELECT m.*, p.status FROM place_media m JOIN places p ON p.id = m.place_id WHERE m.id = ?').get(req.params.mediaId);
    if (!m || (m.status !== 'approved' && !['admin', 'editor'].includes(req.user.role))) throw new HttpError(404, 'Imagem não encontrada.');
    if (m.media_url) return res.redirect(m.media_url);
    sendFile(res, { stream: storage.stream(m.storage_key), fileName: m.source_name, mime: guessImageMime(m.source_name) });
  });

  // ------------------------------------------------------------- ajuda
  r.get('/trips/:tripId/help', tripAccess, (req, res) => {
    const s = settings.all();
    const dest = destinationOf(req.trip);
    res.json({
      whatsapp_url: whatsappLink(s, { user: req.user, trip: req.trip, destination: destinationName(dest) }),
      support_24h: s.support_24h,
      support_hours_text: s.support_24h ? 'Atendimento 24 horas' : s.support_hours_text,
    });
  });

  // ------------------------------------------------------------- notificações
  r.get('/notifications', (req, res) => {
    const items = db
      .prepare('SELECT id, trip_id, kind, title, body, link, essential, read_at, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100')
      .all(req.user.id);
    res.json({ notifications: items, unread: items.filter((n) => !n.read_at).length });
  });

  r.post('/notifications/read', (req, res) => {
    const ids = req.body?.ids;
    const ts = nowIso(now());
    if (Array.isArray(ids)) {
      const stmt = db.prepare('UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ? AND read_at IS NULL');
      for (const id of ids.slice(0, 500)) stmt.run(ts, id, req.user.id);
    } else db.prepare('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL').run(ts, req.user.id);
    res.json({ ok: true });
  });

  // ------------------------------------------------------------- métricas de uso
  r.post('/events', (req, res) => {
    const { name, trip_id } = req.body || {};
    if (!EVENT_NAMES.has(name)) throw new HttpError(422, 'Evento desconhecido.');
    db.prepare('INSERT INTO usage_events (id, user_id, trip_id, name, created_at) VALUES (?, ?, ?, ?, ?)').run(
      newId('evt_'),
      req.user.id,
      typeof trip_id === 'string' ? trip_id.slice(0, 60) : null,
      name,
      nowIso(now()),
    );
    res.status(204).end();
  });

  return { router: r, canSeeDocument };
}

/** /files/:docId — link assinado; revalida a permissão do usuário no momento do download. */
export function signedFileRoute({ db, config, storage }, canSeeDocument, now = () => Date.now()) {
  return (req, res) => {
    const { u, e, s } = req.query;
    const exp = Number(e);
    if (!u || !exp || !s || exp < Math.floor(now() / 1000)) throw new HttpError(410, 'Link expirado. Abra o documento de novo pelo app.');
    if (!safeEqual(s, hmac(config.secret, `${req.params.docId}.${u}.${exp}`))) throw new HttpError(403, 'Link inválido.');
    const user = db.prepare('SELECT * FROM users WHERE id = ? AND disabled_at IS NULL').get(u);
    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.docId);
    if (!user || !doc || !canSeeDocument(user, doc)) throw new HttpError(404, 'Documento não encontrado.');
    if (doc.external_url) return res.redirect(doc.external_url);
    sendFile(res, { stream: storage.stream(doc.storage_key), fileName: doc.source_name || doc.title, mime: doc.mime_type });
  };
}
