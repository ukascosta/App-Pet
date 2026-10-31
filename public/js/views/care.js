// Agenda de cuidados: lembretes de saúde (datas do tutor ou do profissional), banho e tosa e reposições.

import { api } from '../api.js';
import { icon } from '../icons.js';
import { brl, fmtDate, fmtDay, fmtTime, html, raw } from '../util.js';
import { busy, clearErrors, control, field, sheet, showError, toast } from '../ui.js';

const KIND_ICON = { vacina: 'shield', vermifugo: 'pill', antipulgas: 'shield', banho_tosa: 'scissors', consulta: 'clock', outro: 'calendar' };
const STATUS = { late: 'Atrasado', today: 'Hoje', soon: 'Esta semana', upcoming: 'Em breve', done: 'Feito' };
const REPEAT = [['', 'Não repetir'], ['30', 'A cada 30 dias'], ['60', 'A cada 60 dias'], ['90', 'A cada 90 dias'], ['180', 'A cada 6 meses'], ['365', 'Todo ano']];

function addSheet(data, onDone) {
  const today = new Date().toISOString().slice(0, 10);
  let kind = 'vacina';
  sheet(html`<form class="stack" novalidate>
      <h2>Novo lembrete</h2>
      <div class="field"><span class="field__label">Pet</span><div class="chips">${data.pets.map((p, i) => html`<button type="button" class="chip" data-pet="${p.id}" aria-pressed="${i === 0}">${p.name}</button>`)}</div></div>
      <div class="field"><span class="field__label">Tipo</span><div class="chips">${Object.entries(data.kinds).map(([k, label]) => html`<button type="button" class="chip chip--mint" data-kind="${k}" aria-pressed="${k === kind}">${label}</button>`)}</div></div>
      ${field('dueAt', 'Data', html`<div class="control"><input class="control__input" id="f-dueAt" type="date" name="dueAt" min="${today}" value="${today}" /></div>`)}
      <div class="field"><label class="field__label" for="f-repeat">Repetir</label><div class="control"><select class="input" id="f-repeat" name="repeatDays">${REPEAT.map(([v, l]) => html`<option value="${v}">${l}</option>`)}</select></div>
        <span class="field__hint">Use o intervalo indicado pelo veterinário ou pela bula.</span></div>
      ${field('notes', 'Observação (opcional)', control({ name: 'notes', placeholder: 'Ex.: V10, reforço anual', maxlength: 200 }))}
      <p class="disclaimer">${raw(icon('info', 16))}<span>O app só lembra as datas que você cadastra. Ele não indica vacinas, remédios ou doses.</span></p>
      <button class="btn btn--block" type="submit">Salvar lembrete</button>
      <button class="btn btn--ghost btn--block" type="button" data-close>Cancelar</button>
    </form>`.toString(), {
    onMount(el, close) {
      const form = el.querySelector('form');
      let petId = data.pets[0]?.id;
      form.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (b?.dataset.pet) { petId = Number(b.dataset.pet); form.querySelectorAll('[data-pet]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); }
        if (b?.dataset.kind) { kind = b.dataset.kind; form.querySelectorAll('[data-kind]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); }
      });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        clearErrors(form);
        busy(form.querySelector('[type=submit]'), async () => {
          try {
            await api.addCare({ petId, kind, dueAt: `${form.dueAt.value}T09:00:00`, repeatDays: form.repeatDays.value || undefined, notes: form.notes.value });
            close();
            toast('Lembrete salvo. Avisamos você alguns dias antes.');
            onDone();
          } catch (err) {
            showError(form, err);
          }
        });
      });
    },
  });
}

function bookSheet(data, onDone) {
  const days = [...new Set(data.slots.map((s) => s.startsAt.slice(0, 10)))];
  const state = { day: days[0], slotId: null, petId: data.pets[0]?.id };
  const draw = () => html`
    <div class="days">${days.map((d) => html`<button type="button" data-day="${d}" aria-pressed="${d === state.day}">${fmtDay(`${d}T12:00:00`).split(',')[0]}<b>${d.slice(8, 10)}</b></button>`)}</div>
    <div class="slots">${data.slots.filter((s) => s.startsAt.slice(0, 10) === state.day).map((s) => html`<button type="button" class="slot" data-slot="${s.id}" aria-pressed="${s.id === state.slotId}">
      <b>${fmtTime(s.startsAt)}</b><span>${s.serviceLabel} · ${data.member ? html`<s>${brl(s.priceCents)}</s> ${brl(s.clubPriceCents)}` : brl(s.priceCents)}</span></button>`)}</div>`;
  sheet(html`<div class="stack">
      <h2>Agendar banho e tosa</h2>
      ${data.pets.length > 1 ? html`<div class="chips">${data.pets.map((p, i) => html`<button type="button" class="chip" data-pet="${p.id}" aria-pressed="${i === 0}">${p.name}</button>`)}</div>` : ''}
      <div data-slots>${draw()}</div>
      ${data.member ? html`<p class="small" style="color:var(--mint-ink);font-weight:700">Clube Pet: 10% de desconto já aplicado.</p>` : html`<p class="small muted">Assinantes do Clube Pet têm 10% de desconto.</p>`}
      <button class="btn btn--block" data-book disabled>Escolha um horário</button>
      <button class="btn btn--ghost btn--block" data-close>Cancelar</button></div>`.toString(), {
    onMount(el, close) {
      const box = el.querySelector('[data-slots]');
      const btn = el.querySelector('[data-book]');
      el.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.day) { state.day = b.dataset.day; state.slotId = null; box.innerHTML = draw().toString(); }
        if (b.dataset.slot) { state.slotId = Number(b.dataset.slot); box.innerHTML = draw().toString(); }
        if (b.dataset.pet) { state.petId = Number(b.dataset.pet); el.querySelectorAll('[data-pet]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); }
        const s = data.slots.find((x) => x.id === state.slotId);
        btn.disabled = !s;
        btn.textContent = s ? `Confirmar ${fmtDay(s.startsAt)} às ${fmtTime(s.startsAt)}` : 'Escolha um horário';
      });
      btn.addEventListener('click', () => busy(btn, async () => {
        try {
          await api.book({ slotId: state.slotId, petId: state.petId });
          close();
          toast('Horário reservado!');
          onDone();
        } catch (err) {
          toast(err.message);
        }
      }));
    },
  });
}

export async function view({ refresh }) {
  const data = await api.care();
  const booked = data.appointments.filter((a) => a.status === 'booked');
  const item = (ev) => html`<div class="careitem">
    <span class="ptile ${ev.kind === 'banho_tosa' ? 'ptile--mint' : 'ptile--lilac'}" style="width:46px;height:46px;border-radius:15px">${raw(icon(KIND_ICON[ev.kind] ?? 'calendar', 22))}</span>
    <div class="grow"><b>${ev.title}</b><div class="small muted">${ev.petName}${ev.repeatDays ? ` · repete a cada ${ev.repeatDays} dias` : ''}${ev.source === 'loja' ? ' · cadastrado pela loja' : ''}</div>
      ${ev.notes ? html`<div class="small muted">${ev.notes}</div>` : ''}
      <div class="row" style="margin-top:8px;gap:6px"><button class="btn btn--sm btn--dark" data-done="${ev.id}">${raw(icon('check', 16))}Feito</button><button class="btn btn--sm btn--ghost" data-del="${ev.id}" aria-label="Apagar lembrete">${raw(icon('trash', 16))}</button></div></div>
    <div class="when">${fmtDate(ev.dueAt)}<br /><span class="badge badge--${ev.status}" style="margin-top:4px">${STATUS[ev.status]}</span></div>
  </div>`;

  return {
    tab: 'care',
    body: html`
      <header class="pagehead"><h1>Agenda</h1><button class="btn btn--sm" data-add>${raw(icon('plus', 18))}Lembrete</button></header>
      <div class="stack-lg">
        <section class="card stack">
          <div class="row"><span class="ptile ptile--mint">${raw(icon('scissors', 26))}</span><div class="grow"><h2>Banho e tosa</h2><p class="small muted">${data.slots.length ? `${data.slots.length} horários livres nos próximos dias` : 'Sem horários livres no momento'}</p></div></div>
          ${booked.map((a) => html`<div class="notice">${raw(icon('calendar', 18))}<span class="grow"><b>${a.serviceLabel} de ${a.petName}</b><br />${fmtDay(a.startsAt)} às ${fmtTime(a.startsAt)} · ${brl(a.priceCents)}</span><button class="link" data-cancel-appt="${a.id}">Cancelar</button></div>`)}
          ${data.slots.length && data.pets.length ? html`<button class="btn btn--block" data-book>${raw(icon('calendar', 20))}Agendar horário</button>` : ''}
        </section>

        <section class="card">
          <h2 style="margin-bottom:12px">Próximos cuidados</h2>
          ${data.upcoming.length ? data.upcoming.map(item) : html`<p class="muted small">Cadastre vacinas, vermífugo e antipulgas com as datas do veterinário e avisamos você alguns dias antes.</p>`}
        </section>

        ${data.productCycles.length ? html`<section class="card stack"><h2>Reposições previstas</h2><p class="small muted">Pela duração informada na embalagem do que você comprou na loja.</p>
          ${data.productCycles.map((c) => html`<div class="row"><span class="ptile ptile--mint" style="width:42px;height:42px;border-radius:14px">${raw(icon('shield', 20))}</span><div class="grow"><b class="small">${c.name}</b><div class="small muted">Comprado em ${fmtDate(c.boughtAt)} · dura ${c.cycleDays} dias</div></div>
            <span class="badge ${c.daysLeft <= 0 ? 'badge--late' : c.daysLeft <= 7 ? 'badge--soon' : ''}">${c.daysLeft <= 0 ? 'Venceu' : `${c.daysLeft} dias`}</span></div>`)}
          <a class="btn btn--soft btn--block" href="#/loja">Ver na loja</a></section>` : ''}

        <p class="disclaimer">${raw(icon('info', 16))}<span>Os lembretes de saúde seguem as datas cadastradas por você ou pelo profissional. O app não indica tratamentos.</span></p>

        ${data.history.length ? html`<details class="card"><summary style="padding:0">${raw(icon('next', 18))}Histórico de cuidados (${data.history.length})</summary>
          <ul class="ledger" style="margin-top:10px">${data.history.map((h) => html`<li><span>${h.title} · ${h.petName}</span><span class="minus">${fmtDate(h.doneAt)}</span></li>`)}</ul></details>` : ''}
      </div>`,
    mount(root) {
      const main = root.querySelector('main');
      main.addEventListener('click', async (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.matches('[data-add]')) {
          if (!data.pets.length) return toast('Cadastre um pet primeiro.');
          addSheet(data, refresh);
        } else if (b.matches('[data-book]')) bookSheet(data, refresh);
        else if (b.dataset.done) {
          const { next } = await api.careDone(b.dataset.done);
          toast(next ? `Feito! Próximo em ${fmtDate(next.dueAt)}.` : 'Feito!');
          refresh();
        } else if (b.dataset.del) {
          await api.deleteCare(b.dataset.del);
          refresh();
        } else if (b.dataset.cancelAppt) {
          await api.cancelAppointment(b.dataset.cancelAppt).catch((err) => toast(err.message));
          toast('Agendamento cancelado.');
          refresh();
        }
      });
    },
  };
}
