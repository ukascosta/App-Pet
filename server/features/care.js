// Agenda de cuidados. O app só LEMBRA datas cadastradas pelo tutor ou pelo profissional;
// não indica vacina, remédio nem dose.

import { DAY } from './settings.js';

export const CARE_KINDS = {
  vacina: 'Vacina', vermifugo: 'Vermífugo', antipulgas: 'Antipulgas', banho_tosa: 'Banho e tosa', consulta: 'Consulta', outro: 'Outro cuidado',
};
export const SERVICE_LABEL = { banho: 'Banho', banho_tosa: 'Banho e tosa', tosa: 'Tosa higiênica' };

export function careStatus(ev, now) {
  if (ev.done_at) return 'done';
  const days = Math.floor((ev.due_at - now) / DAY);
  if (ev.due_at < now - DAY / 2) return 'late';
  if (days <= 0) return 'today';
  if (days <= 7) return 'soon';
  return 'upcoming';
}

export const careView = (ev, pet, now) => ({
  id: ev.id, petId: ev.pet_id, petName: pet?.name ?? '', kind: ev.kind, kindLabel: CARE_KINDS[ev.kind] ?? ev.kind, title: ev.title,
  dueAt: new Date(ev.due_at).toISOString(), repeatDays: ev.repeat_days, doneAt: ev.done_at ? new Date(ev.done_at).toISOString() : null,
  source: ev.source, notes: ev.notes ?? '', status: careStatus(ev, now),
});

/** Marca como feito; se tiver repetição (informada pelo tutor/profissional), cria o próximo a partir de hoje. */
export function completeCare(repo, ev, now) {
  repo.update('care', ev.id, { done_at: now });
  if (!ev.repeat_days) return null;
  return repo.insert('care', {
    customer_id: ev.customer_id, pet_id: ev.pet_id, kind: ev.kind, title: ev.title, due_at: now + ev.repeat_days * DAY,
    repeat_days: ev.repeat_days, source: ev.source, notes: ev.notes, created_at: now,
  });
}

/** Lembretes a enviar: vencem em até `leadDays` dias e ainda não avisados. */
export const dueReminders = (events, now, leadDays) => events.filter((e) => !e.done_at && !e.notified_at && e.due_at - now <= leadDays * DAY);
