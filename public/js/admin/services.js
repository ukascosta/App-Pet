// Agenda de banho e tosa e assinaturas do Clube Pet.

import { icon } from '../icons.js';
import { brl, fmtDate, fmtTime, html, raw } from '../util.js';
import { busy, confirmSheet, control, field, showError } from '../ui.js';
import { call, kpi, openWhatsApp, toast, waButton } from './core.js';

export async function agenda({ refresh }) {
  const { slots, services } = await call('GET', '/agenda');
  const days = [...new Set(slots.map((s) => s.startsAt.slice(0, 10)))];
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const booked = slots.filter((s) => s.appointment?.status === 'booked').length;
  return {
    title: 'Agenda de banho e tosa',
    body: html`<div class="adm-grid" style="grid-template-columns:minmax(0,1fr) minmax(280px,340px);align-items:start" data-agenda>
      <section class="adm-card">
        <h2>${raw(icon('calendar', 20))}Próximos dias <span class="small muted" style="margin-left:auto">${booked} agendados · ${slots.filter((s) => !s.appointment || s.appointment.status === 'cancelled').length} livres</span></h2>
        ${days.length ? days.map((d) => html`<div class="adm-day">${new Date(`${d}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</div>
          <div class="adm-slots">${slots.filter((s) => s.startsAt.slice(0, 10) === d).map((s) => {
            const a = s.appointment && s.appointment.status !== 'cancelled' ? s.appointment : null;
            return html`<div class="adm-slot ${a ? '' : 'adm-slot--free'}"><b>${fmtTime(s.startsAt)}</b>
              <span>${a ? html`<b style="font-size:.95rem">${a.petName}</b> · ${a.customer}<br /><span class="small muted">${s.serviceLabel} · ${brl(a.priceCents)}${a.status === 'done' ? ' · concluído' : ''}</span>` : html`<span class="small muted">${s.serviceLabel} · ${brl(s.priceCents)} · livre</span>`}</span>
              <span class="row" style="gap:6px">${a ? (a.status === 'booked' ? html`<button class="btn btn--sm btn--dark" data-done="${a.id}">Concluir</button><button class="btn btn--sm btn--ghost" data-cancel="${a.id}" aria-label="Cancelar agendamento">${raw(icon('x', 16))}</button>` : '')
                : html`<button class="btn btn--sm btn--ghost" data-del="${s.id}" aria-label="Remover horário">${raw(icon('trash', 16))}</button>`}</span></div>`;
          })}</div>`) : html`<p class="adm-empty">Nenhum horário aberto. Use o formulário ao lado.</p>`}
      </section>
      <section class="adm-card">
        <h2>${raw(icon('plus', 20))}Abrir horários</h2>
        <form class="adm-form" novalidate data-slots>
          <div class="row2">${field('date', 'Dia', html`<div class="control"><input class="control__input" id="f-date" type="date" name="date" value="${tomorrow}" /></div>`)}
            <div class="field"><label class="field__label" for="f-service">Serviço</label><div class="control"><select class="input" id="f-service" name="service">${Object.entries(services).map(([k, l]) => html`<option value="${k}">${l}</option>`)}</select></div></div></div>
          ${field('times', 'Horários', control({ name: 'times', value: '09:00, 10:30, 14:00, 15:30' }), 'Separe por vírgula')}
          <div class="row2">${field('minutes', 'Duração (min)', control({ name: 'minutes', inputmode: 'numeric', value: '60' }))}${field('priceCents', 'Preço (R$)', control({ name: 'priceCents', inputmode: 'decimal', value: '60,00' }))}</div>
          <button class="btn btn--block" type="submit">Abrir horários</button>
          <p class="small muted">Os horários aparecem para os tutores no app. Assinantes do Clube Pet veem o preço com 10% de desconto.</p>
        </form>
      </section></div>`,
    mount(main) {
      const form = main.querySelector('[data-slots]');
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        busy(form.querySelector('[type=submit]'), async () => {
          try {
            const r = await call('POST', '/slots', { date: form.date.value, service: form.service.value, times: form.times.value, minutes: form.minutes.value, priceCents: Math.round(Number(form.priceCents.value.replace(',', '.')) * 100) });
            toast(`${r.created} horários abertos.`); refresh();
          } catch (err) { showError(form, err); }
        });
      });
      main.addEventListener('click', async (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        try {
          if (b.dataset.done) { await call('POST', `/appointments/${b.dataset.done}/status`, { status: 'done' }); toast('Concluído. Fica no histórico do pet.'); }
          if (b.dataset.cancel) {
            if (!(await confirmSheet({ title: 'Cancelar este agendamento?', text: 'O tutor recebe um aviso no app e o horário volta a ficar livre.', confirmLabel: 'Cancelar agendamento', danger: true }))) return;
            await call('POST', `/appointments/${b.dataset.cancel}/status`, { status: 'cancelled' });
          }
          if (b.dataset.del) await call('DELETE', `/slots/${b.dataset.del}`);
          if (b.dataset.done || b.dataset.cancel || b.dataset.del) refresh();
        } catch (err) { toast(err.message); }
      });
    },
  };
}

export async function club({ refresh }) {
  const d = await call('GET', '/club');
  const active = d.subscriptions.filter((s) => s.active);
  const pending = d.subscriptions.filter((s) => s.status === 'pending');
  const waText = (name) => `Olá, ${name.split(' ')[0]}! Recebemos seu pedido para entrar no Clube Pet (${brl(d.priceCents)}/mês). Como prefere pagar: Pix, cartão ou na loja?`;
  return {
    title: 'Clube Pet',
    body: html`<div class="adm-grid">
      <div class="adm-grid adm-grid--kpi">${kpi('Assinantes', active.length, 'Ativos', 'hot')}${kpi('Receita mensal', brl(active.length * d.priceCents), `${brl(d.priceCents)} por assinante`)}${kpi('Aguardando ativação', pending.length, 'Pedidos feitos no app', pending.length ? 'warn' : '')}</div>
      <div class="adm-grid adm-grid--2">
        <section class="adm-card"><h2>${raw(icon('clock', 20))}Pedidos de assinatura</h2>
          ${pending.length ? pending.map((s) => html`<div class="adm-line"><span class="grow"><b>${s.customer.name}</b><br /><span class="small muted">Pediu em ${fmtDate(s.createdAt)} · ${s.customer.whatsapp ?? ''}</span></span>
            ${s.customer.whatsapp ? waButton('Combinar', `data-wa="${s.customer.whatsapp}" data-name="${s.customer.name}"`) : ''}<button class="btn btn--sm" data-activate="${s.id}">Ativar</button></div>`)
            : html`<p class="adm-empty">Nenhum pedido aguardando.</p>`}
          <p class="small muted" style="margin-top:8px">O app não cobra cartão: combine o pagamento com o cliente e ative aqui. A assinatura renova a cada 30 dias.</p></section>
        <section class="adm-card"><h2>${raw(icon('crown', 20))}Benefícios oferecidos</h2><ul class="tips">${d.benefits.club.map((b) => html`<li>${raw(icon('check', 17))}<span>${b}</span></li>`)}</ul>
          <p class="small muted" style="margin-top:10px">Ajuste percentuais e preço em Configurações.</p></section>
        <section class="adm-card" style="grid-column:1/-1"><h2>${raw(icon('users', 20))}Assinantes</h2><div class="adm-table-wrap"><table class="adm-table">
          <thead><tr><th>Cliente</th><th>WhatsApp</th><th>Desde</th><th>Renova em</th><th class="num">Valor</th><th></th></tr></thead>
          <tbody>${active.map((s) => html`<tr><td><a href="#/clientes/${s.customer.id}">${s.customer.name}</a></td><td>${s.customer.whatsapp ?? '—'}</td><td>${fmtDate(s.startedAt)}</td><td>${fmtDate(s.renewsAt)}</td><td class="num">${brl(s.priceCents)}</td>
            <td class="num"><button class="btn btn--sm btn--soft" data-activate="${s.id}">Renovar 30 dias</button> <button class="btn btn--sm btn--ghost" data-cancel="${s.id}">Cancelar</button></td></tr>`)}</tbody></table></div>
          ${active.length ? '' : html`<p class="adm-empty">Ainda sem assinantes.</p>`}</section>
      </div></div>`,
    mount(main) {
      main.addEventListener('click', async (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.wa) return openWhatsApp(`https://wa.me/55${b.dataset.wa.replace(/\D/g, '')}?text=${encodeURIComponent(waText(b.dataset.name))}`);
        try {
          if (b.dataset.activate) { await call('POST', `/club/${b.dataset.activate}/activate`); toast('Assinatura ativa. O cliente foi avisado.'); }
          if (b.dataset.cancel) {
            if (!(await confirmSheet({ title: 'Cancelar esta assinatura?', text: 'Os benefícios deixam de valer para o cliente.', confirmLabel: 'Cancelar', danger: true }))) return;
            await call('POST', `/club/${b.dataset.cancel}/cancel`);
          }
          refresh();
        } catch (err) { toast(err.message); }
      });
    },
  };
}
