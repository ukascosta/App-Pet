/**
 * Biblioteca de conteúdo (PRD §7): destinos, lugares e imagens, com revisão antes de publicar.
 * Administradores e editores de conteúdo. Editores não acessam dados de viagens.
 */
import { Router } from 'express';
import { HttpError, requireStaff, uploader, uploadedName, sendFile } from '../http.js';
import { DESTINATIONS, PLACES, MEDIA } from '../domain/entities.js';
import { saveEntity } from '../domain/crud.js';
import { audit } from '../lib/audit.js';
import { nowIso } from '../lib/time.js';
import { sha256Buffer } from '../services/storage.js';
import { researchPrompt } from '../domain/prompts.js';

const cellsOf = (body = {}) => Object.fromEntries(Object.entries(body).filter(([k]) => !k.startsWith('_')));

export const destinationName = (d) => (d ? [d.neighborhood, d.city, d.region, d.country].filter(Boolean)[0] : null);

export function adminContentRoutes(services) {
  const { db, config, storage } = services;
  const r = Router();
  r.use(requireStaff);
  const upload = uploader(config);

  const getDest = (id) => {
    const d = db.prepare('SELECT * FROM destinations WHERE id = ?').get(id);
    if (!d) throw new HttpError(404, 'Destino não encontrado.');
    return d;
  };
  const getPlace = (id) => {
    const p = db.prepare('SELECT * FROM places WHERE id = ?').get(id);
    if (!p) throw new HttpError(404, 'Lugar não encontrado.');
    return p;
  };
  const placeView = (p) => ({
    ...p,
    tags: JSON.parse(p.tags || '[]'),
    media: db
      .prepare('SELECT id, display_order, media_url, source_name, alt_text, rights_notes FROM place_media WHERE place_id = ? ORDER BY display_order')
      .all(p.id),
  });

  // ------------------------------------------------------------- destinos
  r.get('/destinations', (req, res) => {
    const rows = db
      .prepare(
        `SELECT d.*, (SELECT COUNT(*) FROM places p WHERE p.destination_id = d.id) places,
                (SELECT COUNT(*) FROM places p WHERE p.destination_id = d.id AND p.status = 'approved') approved
         FROM destinations d ORDER BY d.country, d.region, d.city, d.neighborhood`,
      )
      .all();
    res.json({ destinations: rows.map((d) => ({ ...d, name: destinationName(d) })) });
  });

  r.post('/destinations', (req, res) => {
    const out = saveEntity(services, DESTINATIONS, cellsOf(req.body), { actorId: req.user.id });
    res.status(201).json({ destination: getDest(out.result.id), warnings: out.warnings });
  });

  r.patch('/destinations/:id', (req, res) => {
    const existing = getDest(req.params.id);
    const out = saveEntity(services, DESTINATIONS, { ...cellsOf(req.body), destination_id: existing.id }, { existing, actorId: req.user.id });
    res.json({ destination: getDest(existing.id), warnings: out.warnings });
  });

  r.delete('/destinations/:id', (req, res) => {
    const d = getDest(req.params.id);
    const used =
      db.prepare('SELECT COUNT(*) n FROM trips WHERE destination_id = ?').get(d.id).n +
      db.prepare('SELECT COUNT(*) n FROM places WHERE destination_id = ?').get(d.id).n +
      db.prepare('SELECT COUNT(*) n FROM accommodations WHERE city_id = ?').get(d.id).n +
      db.prepare('SELECT COUNT(*) n FROM itinerary_items WHERE city_id = ?').get(d.id).n +
      db.prepare('SELECT COUNT(*) n FROM destinations WHERE parent_id = ?').get(d.id).n;
    if (used) throw new HttpError(409, 'Destino em uso por viagens, lugares ou outros destinos. Remova as referências antes.');
    db.prepare('DELETE FROM destinations WHERE id = ?').run(d.id);
    audit(db, { actorId: req.user.id, entityType: 'destination', entityId: d.id, action: 'delete', before: d });
    res.json({ ok: true });
  });

  // ------------------------------------------------------------- lugares
  r.get('/places', (req, res) => {
    const { status, destination_id, category, q } = req.query;
    let sql = 'SELECT * FROM places WHERE 1 = 1';
    const args = [];
    if (status) (sql += ' AND status = ?'), args.push(status);
    if (destination_id) (sql += ' AND destination_id = ?'), args.push(destination_id);
    if (category) (sql += ' AND category = ?'), args.push(category);
    if (q) (sql += ' AND (name LIKE ? OR id LIKE ?)'), args.push(`%${q}%`, `%${q}%`);
    sql += ' ORDER BY updated_at DESC LIMIT 1000';
    const counts = Object.fromEntries(db.prepare('SELECT status, COUNT(*) n FROM places GROUP BY status').all().map((x) => [x.status, x.n]));
    res.json({ places: db.prepare(sql).all(...args).map((p) => ({ ...p, tags: JSON.parse(p.tags || '[]') })), counts });
  });

  r.get('/places/:id', (req, res) => res.json({ place: placeView(getPlace(req.params.id)) }));

  r.post('/places', (req, res) => {
    const out = saveEntity(services, PLACES, cellsOf(req.body), { actorId: req.user.id });
    res.status(201).json({ place: placeView(getPlace(out.result.id)), warnings: out.warnings });
  });

  r.patch('/places/:id', (req, res) => {
    const existing = getPlace(req.params.id);
    const out = saveEntity(services, PLACES, { ...cellsOf(req.body), content_id: existing.id }, { existing, actorId: req.user.id });
    res.json({ place: placeView(getPlace(existing.id)), warnings: out.warnings });
  });

  /** Revisão em lote: approve (publica), reject (volta para pendente) ou archive (tira do ar). */
  r.post('/places/review', (req, res) => {
    const { ids, action } = req.body || {};
    const target = { approve: 'approved', reject: 'pending_review', archive: 'archived' }[action];
    if (!target) throw new HttpError(400, 'action deve ser approve, reject ou archive.');
    if (!Array.isArray(ids) || !ids.length || ids.length > 1000) throw new HttpError(400, 'Informe ids (1 a 1000).');
    const ts = nowIso(services.now?.());
    const changed = [];
    const blocked = [];
    db.transaction(() => {
      for (const id of ids) {
        const p = db.prepare('SELECT * FROM places WHERE id = ?').get(id);
        if (!p) continue;
        if (target === 'approved' && (!p.address && p.latitude === null)) {
          blocked.push({ id, reason: 'Sem endereço nem coordenadas: complete antes de aprovar.' });
          continue;
        }
        if (p.status === target) continue;
        db.prepare('UPDATE places SET status = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?').run(target, req.user.id, ts, ts, id);
        audit(db, { actorId: req.user.id, entityType: 'place', entityId: id, action: `review_${action}`, before: { status: p.status }, after: { status: target } });
        changed.push(id);
      }
    })();
    res.json({ changed, blocked });
  });

  /** Só itens nunca publicados podem ser apagados; publicados devem ser arquivados. */
  r.delete('/places/:id', (req, res) => {
    const p = getPlace(req.params.id);
    if (p.reviewed_at && p.status !== 'pending_review') throw new HttpError(409, 'Este lugar já foi revisado. Arquive em vez de excluir.');
    const keys = db.prepare('SELECT storage_key FROM place_media WHERE place_id = ? AND storage_key IS NOT NULL').all(p.id).map((x) => x.storage_key);
    db.prepare('DELETE FROM places WHERE id = ?').run(p.id);
    audit(db, { actorId: req.user.id, entityType: 'place', entityId: p.id, action: 'delete', before: p });
    for (const k of keys) storage.remove(k);
    res.json({ ok: true });
  });

  // ------------------------------------------------------------- imagens
  r.post('/places/:id/media', upload.single('file'), (req, res) => {
    const place = getPlace(req.params.id);
    const cells = { ...cellsOf(req.body), content_id: place.id };
    const attachments = [];
    if (req.file) {
      const name = uploadedName(req.file);
      attachments.push({ name, size: req.file.buffer.length, sha256: sha256Buffer(req.file.buffer), read: () => req.file.buffer });
      cells.image_url_or_upload_name = name;
    }
    if (!cells.display_order) {
      cells.display_order = (db.prepare('SELECT MAX(display_order) m FROM place_media WHERE place_id = ?').get(place.id).m || 0) + 1;
    }
    const out = saveEntity(services, MEDIA, cells, { attachments, actorId: req.user.id });
    res.status(201).json({ place: placeView(getPlace(place.id)), media_id: out.result.id, warnings: out.warnings });
  });

  r.delete('/media/:mediaId', (req, res) => {
    const m = db.prepare('SELECT * FROM place_media WHERE id = ?').get(req.params.mediaId);
    if (!m) throw new HttpError(404, 'Imagem não encontrada.');
    db.prepare('DELETE FROM place_media WHERE id = ?').run(m.id);
    audit(db, { actorId: req.user.id, entityType: 'place_media', entityId: m.id, action: 'delete', before: m });
    if (m.storage_key) storage.remove(m.storage_key);
    res.json({ ok: true });
  });

  r.get('/media/:mediaId/file', (req, res) => {
    const m = db.prepare('SELECT * FROM place_media WHERE id = ?').get(req.params.mediaId);
    if (!m) throw new HttpError(404, 'Imagem não encontrada.');
    if (m.media_url) return res.redirect(m.media_url);
    sendFile(res, { stream: storage.stream(m.storage_key), fileName: m.source_name, mime: guessImageMime(m.source_name) });
  });

  /** Prompt-base (PRD §7.4) preenchido, para a equipe pesquisar com o Claude e importar o resultado. */
  r.get('/content/research-prompt', (req, res) => {
    const city = String(req.query.city || '[CIDADE]').slice(0, 80);
    const country = String(req.query.country || '[PAÍS]').slice(0, 80);
    const destinationId = String(req.query.destination_id || '').slice(0, 60);
    res.json({ prompt: researchPrompt({ city, country, destinationId, settings: services.settings.all(), today: nowIso(services.now?.()).slice(0, 10) }) });
  });

  return r;
}

export function guessImageMime(name = '') {
  const ext = name.toLowerCase().split('.').pop();
  return { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' }[ext] || 'application/octet-stream';
}
