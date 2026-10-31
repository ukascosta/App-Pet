/**
 * Efeitos depois de gravar dados de viagem (pela importação ou pelo painel):
 *  - recalcula as tarefas automáticas das viagens afetadas;
 *  - avisa o viajante de documento novo/substituído visível para ele;
 *  - avisa de mudança no roteiro só quando a equipe marcar "avisar viajantes" (mudança importante).
 */
import { syncTripTasks } from '../services/checklist.js';

const ITINERARY_SHEETS = new Set(['TRIPS', 'FLIGHTS', 'ACCOMMODATIONS', 'ITINERARY']);

export function applyEffects({ db, settings, notifications, now = () => Date.now() }, results, { notify = false } = {}) {
  const trips = new Set();
  const changedItinerary = new Set();
  let notified = 0;
  const s = settings.all();
  for (const r of results) {
    const tripId = r.values?.trip_id || r.after?.trip_id || r.before?.trip_id;
    if (!tripId || r.action === 'unchanged') continue;
    trips.add(tripId);
    if (ITINERARY_SHEETS.has(r.sheet)) changedItinerary.add(tripId);
    if (r.sheet === 'DOCUMENTS') {
      const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(r.id);
      const becameVisible = doc?.visible_to_traveler && (r.action === 'create' || !r.before?.visible_to_traveler || r.fileReplaced);
      if (becameVisible) {
        notified += notifications.notifyTrip(tripId, {
          kind: 'document',
          title: r.fileReplaced ? `Documento atualizado: ${doc.title}` : `Novo documento: ${doc.title}`,
          body: 'A Vagari disponibilizou um documento da sua viagem.',
          link: `/viagem/${encodeURIComponent(tripId)}/documentos`,
          dedupe: `doc:${doc.id}:v${doc.version}`,
        });
      }
    }
  }
  for (const tripId of trips) syncTripTasks(db, tripId, s);
  if (notify) {
    const hour = new Date(now()).toISOString().slice(0, 13);
    for (const tripId of changedItinerary) {
      notified += notifications.notifyTrip(tripId, {
        kind: 'trip_update',
        title: 'Sua viagem foi atualizada',
        body: 'A Vagari atualizou informações do seu roteiro. Confira no app.',
        link: `/viagem/${encodeURIComponent(tripId)}/roteiro`,
        dedupe: `trip_update:${tripId}:${hour}`,
      });
    }
  }
  return { trips: [...trips], notified };
}
