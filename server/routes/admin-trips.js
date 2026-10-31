/**
 * Painel Vagari — viagens e tudo que pende delas (PRD §5).
 * Só administradores. Toda alteração passa pelas mesmas regras da importação e vai para o histórico.
 */
import { Router } from 'express';
import { HttpError, requireAdmin, uploader, uploadedName, sendFile } from '../http.js';
import { TRIPS, TRAVELERS, FLIGHTS, ACCOMMODATIONS, ITINERARY, DOCUMENTS, TASKS, ALL_ENTITIES } from '../domain/entities.js';
import { saveEntity } from '../domain/crud.js';
import { audit } from '../lib/audit.js';
import { newId } from '../lib/ids.js';
import { nowIso } from '../lib/time.js';
import { sha256Buffer } from '../services/storage.js';
import { syncTripTasks } from '../services/checklist.js';
import { buildTripExport } from '../import/templates.js';

const BY_SHEET = Object.fromEntries(ALL_ENTITIES.map((e) => [e.sheet, e]));

/** Remove do corpo os campos de controle (começam com "_"). */
const cellsOf = (body = {}) => Object.fromEntries(Object.entries(body).filter(([k]) => !k.startsWith('_')));

export function tripSummary(db, trip) {
  const count = (sql) => db.prepare(sql).get(trip.id).n;
  const travelers = count('SELECT COUNT(*) n FROM trip_travelers WHERE trip_id = ?');
  const accepted = count("SELECT COUNT(*) n FROM trip_travelers WHERE trip_id = ? AND invitation_status = 'accepted'");
  const flights = count('SELECT COUNT(*) n FROM flight_segments WHERE trip_id = ?');
  const accommodations = count('SELECT COUNT(*) n FROM accommodations WHERE trip_id = ?');
  const itinerary = count('SELECT COUNT(*) n FROM itinerary_items WHERE trip_id = ?');
  const documents = count('SELECT COUNT(*) n FROM documents WHERE trip_id = ? AND visible_to_traveler = 1');
  const missing = [];
  if (!travelers) missing.push('viajantes');
  if (!flights) missing.push('voos');
  if (!accommodations) missing.push('hospedagem');
  if (!documents) missing.push('documentos visíveis');
  return { travelers, accepted, flights, accommodations, itinerary, documents, essential_complete: missing.length === 0, missing };
}

export function adminTripRoutes(services) {
  const { db, auth, mailer, settings, storage, config } = services;
  const r = Router();
  r.use(requireAdmin);
  const upload = uploader(config);

  const getTrip = (id) => {
    const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(id);
    if (!trip) throw new HttpError(404, 'Viagem não encontrada.');
    return trip;
  };

  // ------------------------------------------------------------- viagens
  r.get('/trips', (req, res) => {
    const { status, q } = req.query;
    let sql = `SELECT t.*, d.city, d.country FROM trips t JOIN destinations d ON d.id = t.destination_id WHERE 1 = 1`;
    const args = [];
    if (status) {
      sql += ' AND t.status = ?';
      args.push(status);
    }
    if (q) {
      sql += ` AND (t.id LIKE ? OR t.name LIKE ? OR EXISTS (
        SELECT 1 FROM trip_travelers tt JOIN users u ON u.id = tt.user_id WHERE tt.trip_id = t.id AND (u.email LIKE ? OR u.name LIKE ?)))`;
      const like = `%${q}%`;
      args.push(like, like, like, like);
    }
    sql += ' ORDER BY t.start_date DESC LIMIT 500';
    res.json({ trips: db.prepare(sql).all(...args).map((t) => ({ ...t, summary: tripSummary(db, t) })) });
  });

  r.post('/trips', (req, res) => {
    const out = saveEntity(services, TRIPS, cellsOf(req.body), { actorId: req.user.id });
    res.status(201).json({ trip: getTrip(out.result.id), warnings: out.warnings });
  });

  r.get('/trips/:id', (req, res) => {
    const trip = getTrip(req.params.id);
    const id = trip.id;
    res.json({
      trip,
      summary: tripSummary(db, trip),
      destination: db.prepare('SELECT * FROM destinations WHERE id = ?').get(trip.destination_id),
      travelers: db
        .prepare(
          `SELECT tt.id, tt.traveler_role, tt.invitation_status, u.id user_id, u.email, u.name, u.phone, u.nationality, u.last_login_at
           FROM trip_travelers tt JOIN users u ON u.id = tt.user_id WHERE tt.trip_id = ? ORDER BY tt.created_at`,
        )
        .all(id),
      flights: db.prepare('SELECT * FROM flight_segments WHERE trip_id = ? ORDER BY segment_order').all(id),
      accommodations: db.prepare('SELECT * FROM accommodations WHERE trip_id = ? ORDER BY checkin_at').all(id),
      itinerary: db.prepare('SELECT * FROM itinerary_items WHERE trip_id = ? ORDER BY date, start_time').all(id),
      documents: db
        .prepare('SELECT id, external_id, category, title, stage, source_name, external_url, mime_type, size_bytes, visible_to_traveler, version, notes, updated_at FROM documents WHERE trip_id = ? ORDER BY created_at')
        .all(id),
      tasks: db
        .prepare(
          `SELECT t.*, (SELECT COUNT(*) FROM task_completions c WHERE c.task_id = t.id) completions
           FROM tasks t WHERE t.trip_id = ? ORDER BY t.active DESC, t.due_date IS NOT NULL, t.due_date`,
        )
        .all(id),
      announcements: db.prepare('SELECT * FROM announcements WHERE trip_id = ? ORDER BY created_at DESC').all(id),
      highlights: db
        .prepare('SELECT tp.place_id, tp.note, p.name, p.status FROM trip_places tp JOIN places p ON p.id = tp.place_id WHERE tp.trip_id = ?')
        .all(id),
    });
  });

  r.patch('/trips/:id', (req, res) => {
    const trip = getTrip(req.params.id);
    const cells = cellsOf(req.body);
    if (cells.trip_id && cells.trip_id !== trip.id) throw new HttpError(400, 'O código da viagem (trip_id) não pode ser alterado.');
    const out = saveEntity(services, TRIPS, { ...cells, trip_id: trip.id }, { existing: trip, actorId: req.user.id, notify: !!req.body._notify });
    res.json({ trip: getTrip(trip.id), warnings: out.warnings });
  });

  /** Exclusão definitiva: exige confirmar digitando o código da viagem. Preferir arquivar. */
  r.delete('/trips/:id', (req, res) => {
    const trip = getTrip(req.params.id);
    if (req.query.confirm !== trip.id) throw new HttpError(400, 'Para excluir, confirme com ?confirm=<código da viagem>. Prefira arquivar.');
    const keys = db
      .prepare(
        `SELECT dv.storage_key FROM document_versions dv JOIN documents d ON d.id = dv.document_id WHERE d.trip_id = ? AND dv.storage_key IS NOT NULL`,
      )
      .all(trip.id)
      .map((x) => x.storage_key);
    db.transaction(() => {
      db.prepare('DELETE FROM trips WHERE id = ?').run(trip.id);
      audit(db, { actorId: req.user.id, entityType: 'trip', entityId: trip.id, tripId: trip.id, action: 'delete', before: trip });
    })();
    for (const k of keys) storage.remove(k);
    res.json({ ok: true });
  });

  r.get('/trips/:id/export.xlsx', async (req, res) => {
    const trip = getTrip(req.params.id);
    const buffer = await buildTripExport(db, trip.id, BY_SHEET, settings.all());
    sendFile(res, { buffer, fileName: `viagem-${trip.id}.xlsx`, mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', inline: false });
  });

  r.post('/trips/:id/sync-tasks', (req, res) => {
    const trip = getTrip(req.params.id);
    res.json({ result: syncTripTasks(db, trip.id, settings.all()) });
  });

  // ------------------------------------------------------------- viajantes
  const getTripTraveler = (tripId, ttId) => {
    const row = db
      .prepare(
        `SELECT tt.*, u.email, u.name, u.phone, u.nationality FROM trip_travelers tt JOIN users u ON u.id = tt.user_id
         WHERE tt.id = ? AND tt.trip_id = ?`,
      )
      .get(ttId, tripId);
    if (!row) throw new HttpError(404, 'Viajante não encontrado nesta viagem.');
    return row;
  };

  r.post('/trips/:id/travelers', (req, res) => {
    const trip = getTrip(req.params.id);
    const out = saveEntity(services, TRAVELERS, { ...cellsOf(req.body), trip_id: trip.id }, { actorId: req.user.id });
    res.status(201).json({ traveler: getTripTraveler(trip.id, out.result.id), warnings: out.warnings });
  });

  r.patch('/trips/:id/travelers/:ttId', (req, res) => {
    const existing = getTripTraveler(req.params.id, req.params.ttId);
    const cells = cellsOf(req.body);
    if (cells.traveler_email && cells.traveler_email.toLowerCase() !== existing.email.toLowerCase())
      throw new HttpError(400, 'Para trocar o e-mail, remova o viajante e associe o novo e-mail.');
    const out = saveEntity(services, TRAVELERS, { ...cells, trip_id: existing.trip_id, traveler_email: existing.email }, { existing, actorId: req.user.id });
    res.json({ traveler: getTripTraveler(existing.trip_id, existing.id), warnings: out.warnings });
  });

  r.delete('/trips/:id/travelers/:ttId', (req, res) => {
    const existing = getTripTraveler(req.params.id, req.params.ttId);
    db.transaction(() => {
      db.prepare('DELETE FROM trip_travelers WHERE id = ?').run(existing.id);
      audit(db, { actorId: req.user.id, entityType: 'trip_traveler', entityId: existing.id, tripId: existing.trip_id, action: 'delete', before: { email: existing.email, traveler_role: existing.traveler_role } });
    })();
    syncTripTasks(db, existing.trip_id, settings.all());
    res.json({ ok: true });
  });

  /** Gera o convite (link de uso único, com validade) e, se pedido, envia por e-mail. */
  r.post('/trips/:id/travelers/:ttId/invite', async (req, res) => {
    const tt = getTripTraveler(req.params.id, req.params.ttId);
    const trip = getTrip(tt.trip_id);
    if (trip.status !== 'published') throw new HttpError(409, 'Publique a viagem antes de convidar os viajantes.');
    const invite = auth.createInvite(tt.id, req.user.id);
    audit(db, { actorId: req.user.id, entityType: 'trip_traveler', entityId: tt.id, tripId: trip.id, action: 'invite', after: { email: tt.email, expires_at: invite.expiresAt } });
    let emailed = false;
    if (req.body?.send_email !== false) {
      const agency = settings.get('agency_name');
      await mailer.send({
        to: tt.email,
        subject: `${agency}: sua viagem "${trip.name}" está no app`,
        text: `Olá${tt.name ? `, ${tt.name.split(' ')[0]}` : ''}!\n\nA ${agency} preparou tudo da sua viagem "${trip.name}" em um só lugar.\nAcesse pelo link (pessoal e de uso único):\n${invite.url}\n\nO link vale até ${invite.expiresAt.slice(0, 10)}. Depois, é só entrar com este e-mail e receber um código.`,
      });
      emailed = true;
    }
    res.json({ invite_url: invite.url, expires_at: invite.expiresAt, emailed });
  });

  // ------------------------------------------------------------- voos, hospedagens, roteiro, tarefas
  const SUB = {
    flights: { entity: FLIGHTS, table: 'flight_segments', order: 'segment_order' },
    accommodations: { entity: ACCOMMODATIONS, table: 'accommodations', order: 'checkin_at' },
    itinerary: { entity: ITINERARY, table: 'itinerary_items', order: 'date, start_time' },
    tasks: { entity: TASKS, table: 'tasks', order: 'due_date' },
  };

  for (const [path, { entity, table, order }] of Object.entries(SUB)) {
    const getItem = (tripId, itemId) => {
      const row = db.prepare(`SELECT * FROM ${table} WHERE id = ? AND trip_id = ?`).get(itemId, tripId);
      if (!row) throw new HttpError(404, 'Item não encontrado.');
      return row;
    };

    r.get(`/trips/:id/${path}`, (req, res) => {
      getTrip(req.params.id);
      res.json({ items: db.prepare(`SELECT * FROM ${table} WHERE trip_id = ? ORDER BY ${order}`).all(req.params.id) });
    });

    r.post(`/trips/:id/${path}`, (req, res) => {
      const trip = getTrip(req.params.id);
      const out = saveEntity(services, entity, { ...cellsOf(req.body), trip_id: trip.id }, { actorId: req.user.id, notify: !!req.body?._notify });
      res.status(201).json({ item: getItem(trip.id, out.result.id), warnings: out.warnings });
    });

    r.patch(`/trips/:id/${path}/:itemId`, (req, res) => {
      const existing = getItem(req.params.id, req.params.itemId);
      if (table === 'tasks' && existing.source === 'rule')
        throw new HttpError(409, 'Esta tarefa vem de uma regra automática. Edite a regra em Configurações › Jornada de preparação.');
      const out = saveEntity(services, entity, { ...cellsOf(req.body), trip_id: existing.trip_id }, { existing, actorId: req.user.id, notify: !!req.body?._notify });
      res.json({ item: getItem(existing.trip_id, existing.id), warnings: out.warnings });
    });

    r.delete(`/trips/:id/${path}/:itemId`, (req, res) => {
      const existing = getItem(req.params.id, req.params.itemId);
      if (table === 'tasks' && existing.source === 'rule')
        throw new HttpError(409, 'Esta tarefa vem de uma regra automática. Desative a regra ou ajuste as condições dela.');
      db.transaction(() => {
        db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(existing.id);
        audit(db, { actorId: req.user.id, entityType: entity.entityType, entityId: existing.id, tripId: existing.trip_id, action: 'delete', before: existing });
      })();
      res.json({ ok: true });
    });
  }

  // ------------------------------------------------------------- documentos
  const getDoc = (tripId, docId) => {
    const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND trip_id = ?').get(docId, tripId);
    if (!doc) throw new HttpError(404, 'Documento não encontrado.');
    return doc;
  };
  const toAttachment = (f) => {
    const name = uploadedName(f);
    return { name, size: f.buffer.length, sha256: sha256Buffer(f.buffer), read: () => f.buffer };
  };
  const publicDoc = (d) => {
    const { storage_key, sha256, ...rest } = d;
    return rest;
  };

  /** multipart: file (opcional se houver file_url_or_upload_name com link), category, file_name, visible_to_traveler, stage, notes, document_id. */
  r.post('/trips/:id/documents', upload.single('file'), (req, res) => {
    const trip = getTrip(req.params.id);
    const attachments = req.file ? [toAttachment(req.file)] : [];
    const cells = { ...cellsOf(req.body), trip_id: trip.id };
    if (req.file) cells.file_url_or_upload_name = attachments[0].name;
    if (!cells.file_name && req.file) cells.file_name = attachments[0].name.replace(/\.[^.]+$/, '');
    const out = saveEntity(services, DOCUMENTS, cells, { attachments, actorId: req.user.id });
    res.status(201).json({ document: publicDoc(getDoc(trip.id, out.result.id)), warnings: out.warnings });
  });

  r.patch('/trips/:id/documents/:docId', (req, res) => {
    const existing = getDoc(req.params.id, req.params.docId);
    const cells = cellsOf(req.body);
    delete cells.file_url_or_upload_name; // troca de arquivo é pela rota /file
    const out = saveEntity(services, DOCUMENTS, { ...cells, trip_id: existing.trip_id }, { existing, actorId: req.user.id });
    res.json({ document: publicDoc(getDoc(existing.trip_id, existing.id)), warnings: out.warnings });
  });

  /** Substitui o arquivo, mantendo o histórico de versões. */
  r.post('/trips/:id/documents/:docId/file', upload.single('file'), (req, res) => {
    const existing = getDoc(req.params.id, req.params.docId);
    if (!req.file) throw new HttpError(400, 'Envie o arquivo no campo "file".');
    const att = toAttachment(req.file);
    // Nome interno único para forçar nova versão mesmo que o nome do arquivo seja igual.
    const out = saveEntity(services, DOCUMENTS, { trip_id: existing.trip_id, file_url_or_upload_name: att.name }, { existing, attachments: [att], actorId: req.user.id });
    res.json({ document: publicDoc(getDoc(existing.trip_id, existing.id)), warnings: out.warnings });
  });

  r.get('/trips/:id/documents/:docId/versions', (req, res) => {
    const doc = getDoc(req.params.id, req.params.docId);
    res.json({
      versions: db
        .prepare('SELECT id, version, file_name, external_url, mime_type, size_bytes, uploaded_by, created_at FROM document_versions WHERE document_id = ? ORDER BY version DESC')
        .all(doc.id),
    });
  });

  r.get('/trips/:id/documents/:docId/file', (req, res) => {
    const doc = getDoc(req.params.id, req.params.docId);
    const version = req.query.version
      ? db.prepare('SELECT * FROM document_versions WHERE document_id = ? AND version = ?').get(doc.id, Number(req.query.version))
      : { storage_key: doc.storage_key, external_url: doc.external_url, mime_type: doc.mime_type, file_name: doc.source_name };
    if (!version) throw new HttpError(404, 'Versão não encontrada.');
    audit(db, { actorId: req.user.id, entityType: 'document', entityId: doc.id, tripId: doc.trip_id, action: 'download', after: { version: req.query.version || doc.version } });
    if (version.external_url) return res.redirect(version.external_url);
    if (!version.storage_key || !storage.exists(version.storage_key)) throw new HttpError(404, 'Arquivo não encontrado.');
    sendFile(res, { stream: storage.stream(version.storage_key), fileName: version.file_name || doc.title, mime: version.mime_type });
  });

  r.delete('/trips/:id/documents/:docId', (req, res) => {
    const doc = getDoc(req.params.id, req.params.docId);
    const keys = db.prepare('SELECT storage_key FROM document_versions WHERE document_id = ? AND storage_key IS NOT NULL').all(doc.id).map((x) => x.storage_key);
    db.transaction(() => {
      db.prepare('DELETE FROM documents WHERE id = ?').run(doc.id);
      audit(db, { actorId: req.user.id, entityType: 'document', entityId: doc.id, tripId: doc.trip_id, action: 'delete', before: publicDoc(doc) });
    })();
    for (const k of keys) storage.remove(k);
    res.json({ ok: true });
  });

  // ------------------------------------------------------------- avisos
  /** Publica um aviso para uma ou várias viagens (grupo). */
  r.post('/announcements', (req, res) => {
    const { trip_ids, title, body, essential = false } = req.body || {};
    if (!Array.isArray(trip_ids) || !trip_ids.length) throw new HttpError(400, 'Informe trip_ids (uma ou mais viagens).');
    if (!title?.trim() || title.length > 120) throw new HttpError(400, 'Informe um título de até 120 caracteres.');
    if (!body?.trim() || body.length > 4000) throw new HttpError(400, 'Informe o texto do aviso (até 4000 caracteres).');
    for (const id of trip_ids) getTrip(id);
    const created = [];
    let notified = 0;
    for (const tripId of trip_ids) {
      const id = newId('ann_');
      db.prepare('INSERT INTO announcements (id, trip_id, title, body, essential, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        id,
        tripId,
        title.trim(),
        body.trim(),
        essential ? 1 : 0,
        req.user.id,
        nowIso(services.now?.()),
      );
      audit(db, { actorId: req.user.id, entityType: 'announcement', entityId: id, tripId, action: 'create', after: { title, essential: !!essential } });
      notified += services.notifications.notifyTrip(tripId, {
        kind: 'announcement',
        title: title.trim(),
        body: body.trim(),
        link: `/viagem/${encodeURIComponent(tripId)}`,
        essential: !!essential,
        dedupe: `ann:${id}`,
      });
      created.push(id);
    }
    res.status(201).json({ announcement_ids: created, notified });
  });

  r.delete('/announcements/:annId', (req, res) => {
    const ann = db.prepare('SELECT * FROM announcements WHERE id = ?').get(req.params.annId);
    if (!ann) throw new HttpError(404, 'Aviso não encontrado.');
    db.prepare('DELETE FROM announcements WHERE id = ?').run(ann.id);
    audit(db, { actorId: req.user.id, entityType: 'announcement', entityId: ann.id, tripId: ann.trip_id, action: 'delete', before: ann });
    res.json({ ok: true });
  });

  // ------------------------------------------------------------- destaques do guia para a viagem
  r.put('/trips/:id/highlights/:placeId', (req, res) => {
    const trip = getTrip(req.params.id);
    const place = db.prepare('SELECT * FROM places WHERE id = ?').get(req.params.placeId);
    if (!place) throw new HttpError(404, 'Lugar não encontrado.');
    const note = req.body?.note ? String(req.body.note).slice(0, 500) : null;
    db.prepare(
      'INSERT INTO trip_places (trip_id, place_id, note, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(trip_id, place_id) DO UPDATE SET note = excluded.note',
    ).run(trip.id, place.id, note, nowIso(services.now?.()));
    audit(db, { actorId: req.user.id, entityType: 'trip_place', entityId: `${trip.id}:${place.id}`, tripId: trip.id, action: 'upsert', after: { note } });
    res.json({ ok: true, warning: place.status !== 'approved' ? 'O lugar ainda não está aprovado: só aparecerá depois da aprovação.' : null });
  });

  r.delete('/trips/:id/highlights/:placeId', (req, res) => {
    db.prepare('DELETE FROM trip_places WHERE trip_id = ? AND place_id = ?').run(req.params.id, req.params.placeId);
    audit(db, { actorId: req.user.id, entityType: 'trip_place', entityId: `${req.params.id}:${req.params.placeId}`, tripId: req.params.id, action: 'delete' });
    res.json({ ok: true });
  });

  return r;
}
