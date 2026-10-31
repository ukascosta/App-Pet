// Painel, oportunidades e clientes.

import { petAvatar } from '../art.js';
import { icon } from '../icons.js';
import { brl, fmtDate, html, raw } from '../util.js';
import { busy, control, field, sheet, showError } from '../ui.js';
import { call, kpi, openWhatsApp, pct, toast, waButton } from './core.js';

// ---------------- painel ----------------

function revenueChart(weeks) {
  const W = 420, H = 210, padL = 62, padB = 28, padT = 12;
  const max = Math.max(1, ...weeks.map((w) => w.appCents + w.storeCents));
  // escala "redonda": 250, 500, 1.000, 2.500, 5.000 reais…
  const steps = [25000, 50000, 100000, 250000, 500000, 1000000, 2500000];
  const nice = steps.find((s) => s >= max) ?? Math.ceil(max / 1000000) * 1000000;
  const bw = (W - padL - 8) / weeks.length;
  const y = (v) => H - padB - ((H - padB - padT) * v) / nice;
  const label = (c) => (c >= 100000 ? `R$ ${(c / 100000).toLocaleString('pt-BR')} mil` : `R$ ${(c / 100).toLocaleString('pt-BR')}`);
  return html`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Faturamento por semana nas últimas 8 semanas, separado entre app e loja">
    ${[0, nice / 2, nice].map((t) => html`<line x1="${padL}" x2="${W - 4}" y1="${y(t)}" y2="${y(t)}" stroke="var(--line)" stroke-width="1" />
      <text x="${padL - 8}" y="${y(t) + 4}" text-anchor="end" font-size="12" fill="var(--ink-3)" font-family="Nunito, sans-serif" font-weight="700">${label(t)}</text>`)}
    ${weeks.map((w, i) => {
      const x = padL + i * bw + bw * 0.16;
      const bwi = bw * 0.68;
      return html`<rect x="${x}" y="${y(w.storeCents)}" width="${bwi}" height="${y(0) - y(w.storeCents)}" rx="3" fill="var(--mint)"><title>Loja: ${brl(w.storeCents)}</title></rect>
        <rect x="${x}" y="${y(w.storeCents + w.appCents)}" width="${bwi}" height="${y(0) - y(w.appCents)}" rx="3" fill="var(--orange)"><title>App: ${brl(w.appCents)}</title></rect>
        ${i % 2 === 1 || i === weeks.length - 1 ? html`<text x="${x + bwi / 2}" y="${H - 8}" text-anchor="middle" font-size="12" fill="var(--ink-3)" font-family="Nunito, sans-serif" font-weight="700">${new Date(w.start).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</text>` : ''}`;
    })}
  </svg>
  <div class="legend"><span><i style="background:var(--orange)"></i>Pedidos pelo app</span><span><i style="background:var(--mint)"></i>Vendas na loja</span></div>`;
}

export async function dashboard() {
  const d = await call('GET', '/dashboard');
  const m = d.metrics;
  return {
    title: 'Painel',
    actions: html`<a class="btn btn--sm" href="#/pedidos/novo">${raw(icon('plus', 18))}Registrar venda</a>`,
    body: html`<div class="adm-grid">
      <div class="adm-grid adm-grid--kpi">
        ${kpi('Reposições próximas', m.refillsSoon, 'Pets com ração acabando', 'hot')}
        ${kpi('Reposições atrasadas', m.refillsLate, 'Pets sem ração', m.refillsLate ? 'warn' : '')}
        ${kpi('Tutores cadastrados', m.customers, `${m.pets} pets monitorados`)}
        ${kpi('Pedidos pelo app', m.appOrders, `${brl(m.appRevenueCents)} em 30 dias${m.pendingAppOrders ? ` · ${m.pendingAppOrders} aguardando` : ''}`)}
        ${kpi('Receita recorrente', brl(m.recurringRevenueCents), `Clube ${brl(m.clubMrrCents)} + reposição ${brl(m.recurringRationCents)}`)}
        ${kpi('Assinantes do clube', m.members, m.pendingMembers ? `${m.pendingMembers} aguardando ativação` : 'Clube Pet ativo')}
        ${kpi('Ticket médio', brl(m.avgTicketCents), `${m.ordersCount} pedidos em 30 dias`)}
        ${kpi('Taxa de recompra', pct(m.repurchaseRate), 'Clientes com 2+ compras em 180 dias')}
      </div>
      <div class="adm-grid adm-grid--2">
        <section class="adm-card"><h2>${raw(icon('target', 20))}Oportunidades de venda hoje <a class="small" style="margin-left:auto" href="#/oportunidades">Ver todas (${d.opportunitiesOpen})</a></h2>
          ${d.today.length ? d.today.map((o) => html`<a class="adm-line" href="#/oportunidades" style="text-decoration:none;color:inherit">
            <span class="grow"><b>${o.customer.name}</b>${o.pet ? ` — ${o.pet.name}` : ''}<br /><span class="small muted">${o.title}</span></span>
            <span style="display:grid;gap:4px;justify-items:end"><span class="prio prio--${o.kind}">${o.kindLabel}</span>${o.status === 'contacted' ? html`<span class="st st--${o.status}">${o.statusLabel}</span>` : ''}</span></a>`) : html`<p class="adm-empty">Nenhuma oportunidade aberta. 🎉</p>`}
        </section>
        <section class="adm-card"><h2>${raw(icon('chart', 20))}Faturamento por semana</h2>${revenueChart(m.weeks)}
          <p class="small muted" style="margin-top:8px">30 dias: ${brl(m.revenueCents)} em ${m.ordersCount} pedidos.</p></section>
        <section class="adm-card"><h2>${raw(icon('box', 20))}Mais vendidos (30 dias)</h2>
          ${d.topProducts.length ? d.topProducts.map((p) => html`<div class="adm-line"><span class="grow">${p.name}</span><b class="num">${p.qty} un.</b></div>`) : html`<p class="adm-empty">Sem vendas nos últimos 30 dias.</p>`}</section>
        <section class="adm-card"><h2>${raw(icon('warn', 20))}Estoque baixo</h2>
          ${d.lowStock.length ? d.lowStock.map((p) => html`<a class="adm-line" href="#/produtos" style="text-decoration:none;color:inherit"><span class="grow">${p.name}</span><b class="num" style="color:var(--danger-ink)">${p.stock} un.</b></a>`) : html`<p class="adm-empty">Nenhum produto com 3 unidades ou menos.</p>`}</section>
      </div>
    </div>`,
  };
}

// ---------------- oportunidades ----------------

const KIND_FILTERS = [['todas', 'Todas'], ['alta', 'Alta prioridade'], ['reposicao', 'Reposição'], ['recuperacao', 'Recuperação'], ['complementar', 'Complementar'], ['aniversario', 'Aniversário']];
const STATUS_FILTERS = [['abertas', 'Abertas'], ['won', 'Vendidas'], ['dismissed', 'Descartadas']];
const filters = { kind: 'todas', status: 'abertas' };

export async function opportunities({ refresh }) {
  const { opportunities: all } = await call('GET', '/opportunities');
  const list = all.filter((o) => (filters.kind === 'todas' || o.kind === filters.kind) && (filters.status === 'abertas' ? ['new', 'contacted'].includes(o.status) : o.status === filters.status));
  const count = (k) => all.filter((o) => ['new', 'contacted'].includes(o.status) && (k === 'todas' || o.kind === k)).length;
  return {
    title: 'Oportunidades de venda',
    body: html`
      <p class="muted" style="margin:-10px 0 16px;font-weight:600">Lista automática de quem precisa de uma ação hoje: ração acabando, clientes sumidos, cuidados e produtos perto do fim e aniversários do clube.</p>
      <div class="adm-filters">${KIND_FILTERS.map(([k, l]) => html`<button class="chip" data-kind="${k}" aria-pressed="${filters.kind === k}">${l} (${count(k)})</button>`)}</div>
      <div class="adm-filters">${STATUS_FILTERS.map(([k, l]) => html`<button class="chip chip--mint" data-status="${k}" aria-pressed="${filters.status === k}">${l}</button>`)}</div>
      <div class="adm-grid adm-grid--3">
        ${list.length ? list.map((o) => html`<article class="adm-card opp" data-key="${o.key}">
          <div class="opp-top"><span class="prio prio--${o.kind}">${o.kindLabel}</span><span class="st st--${o.status}">${o.statusLabel}</span></div>
          <div class="row">${o.pet ? raw(petAvatar(o.pet)) : ''}<div class="grow"><h3>${o.customer.name}${o.pet ? ` — ${o.pet.name}` : ''}</h3><div class="small muted">${o.customer.whatsapp}</div></div></div>
          <div><b>${o.title}</b><div class="small muted">${o.detail}</div></div>
          <label class="sr-only" for="msg-${o.key}">Mensagem</label>
          <textarea id="msg-${o.key}" data-msg>${o.message}</textarea>
          <div class="opp-actions">${waButton('Chamar no WhatsApp', 'data-wa')}
            <button class="btn btn--sm btn--dark" data-set="won">${raw(icon('check', 16))}Vendido</button>
            <button class="btn btn--sm btn--ghost" data-set="dismissed">Descartar</button>
            ${o.status === 'contacted' ? html`<button class="btn btn--sm btn--ghost" data-set="new">Reabrir</button>` : ''}</div>
          <div class="control"><input class="control__input" data-note placeholder="Anotação (ex.: entrega sexta)" value="${o.note}" maxlength="300" aria-label="Anotação" /></div>
        </article>`) : html`<p class="adm-empty">Nada aqui com esses filtros.</p>`}
      </div>`,
    mount(main) {
      main.addEventListener('click', async (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.kind) { filters.kind = b.dataset.kind; return refresh(); }
        if (b.dataset.status) { filters.status = b.dataset.status; return refresh(); }
        const card = b.closest('[data-key]');
        if (!card) return;
        const key = encodeURIComponent(card.dataset.key);
        const o = all.find((x) => x.key === card.dataset.key);
        if (b.matches('[data-wa]')) {
          // a mensagem pode ter sido editada antes de enviar
          const text = card.querySelector('[data-msg]').value;
          openWhatsApp(o.whatsappLink.replace(/\?text=.*$/, `?text=${encodeURIComponent(text)}`));
          if (o.status === 'new') await call('PATCH', `/opportunities/${key}`, { status: 'contacted' });
          return refresh();
        }
        if (b.dataset.set) {
          await call('PATCH', `/opportunities/${key}`, { status: b.dataset.set, note: card.querySelector('[data-note]').value });
          toast(b.dataset.set === 'won' ? 'Marcada como vendida.' : 'Atualizada.');
          refresh();
        }
      });
      main.addEventListener('change', async (e) => {
        const input = e.target.closest('[data-note]');
        if (!input) return;
        await call('PATCH', `/opportunities/${encodeURIComponent(input.closest('[data-key]').dataset.key)}`, { note: input.value });
        toast('Anotação salva.');
      });
    },
  };
}

// ---------------- clientes ----------------

let query = '';
export async function customers({ refresh, navigate }) {
  const { customers: list } = await call('GET', `/customers?q=${encodeURIComponent(query)}`);
  return {
    title: 'Clientes',
    actions: html`<div class="control" style="min-width:260px"><span class="control__icon">${raw(icon('search', 18))}</span><input class="control__input" data-search placeholder="Buscar nome, e-mail ou WhatsApp" value="${query}" aria-label="Buscar cliente" /></div>`,
    body: html`<section class="adm-card"><div class="adm-table-wrap"><table class="adm-table">
      <thead><tr><th>Tutor</th><th>Pets</th><th>Clube</th><th class="num">Compras</th><th class="num">Total gasto</th><th>Última compra</th><th class="num">Pontos</th></tr></thead>
      <tbody>${list.map((c) => html`<tr data-href="#/clientes/${c.id}"><td><b>${c.name}</b><br /><span class="small muted">${c.whatsapp ?? 'sem WhatsApp'}</span></td>
        <td>${c.pets.map((p) => p.name).join(', ') || '—'}</td><td>${c.member ? html`<span class="prio prio--complementar">${raw(icon('crown', 13))}Clube</span>` : '—'}</td>
        <td class="num">${c.orders}</td><td class="num">${brl(c.spentCents)}</td><td>${c.lastOrderAt ? fmtDate(c.lastOrderAt) : '—'}</td><td class="num">${c.points}</td></tr>`)}</tbody>
    </table></div>${list.length ? '' : html`<p class="adm-empty">Nenhum cliente encontrado.</p>`}</section>`,
    mount(main) {
      main.querySelectorAll('[data-href]').forEach((tr) => tr.addEventListener('click', () => navigate(tr.dataset.href)));
      const input = main.querySelector('[data-search]');
      let t;
      input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { query = input.value; refresh().then(() => { const i = document.querySelector('[data-search]'); i?.focus(); i?.setSelectionRange(i.value.length, i.value.length); }); }, 350); });
    },
  };
}

const CARE_KINDS = { vacina: 'Vacina', vermifugo: 'Vermífugo', antipulgas: 'Antipulgas', banho_tosa: 'Banho e tosa', consulta: 'Consulta', outro: 'Outro cuidado' };

export async function customer({ params, refresh }) {
  const d = await call('GET', `/customers/${params[0]}`);
  const c = d.customer;
  const LEVEL = { ok: 'Em dia', low: 'Acabando', empty: 'Acabou' };
  return {
    title: c.name,
    actions: html`<a class="btn btn--sm btn--ghost" href="#/clientes">${raw(icon('back', 18))}Clientes</a>
      ${c.whatsappLink ? waButton('WhatsApp', `data-open="${c.whatsappLink}"`) : ''}
      <a class="btn btn--sm" href="#/pedidos/novo?cliente=${c.id}">${raw(icon('plus', 18))}Registrar venda</a>`,
    body: html`<div class="adm-grid">
      <div class="adm-grid adm-grid--kpi">
        ${kpi('Compras', c.orders, c.lastOrderAt ? `Última em ${fmtDate(c.lastOrderAt)}` : 'Ainda não comprou')}
        ${kpi('Total gasto', brl(c.spentCents))}
        ${kpi('Pontos', d.points.balance, d.points.expiringIn30Days ? `${d.points.expiringIn30Days} vencem em 30 dias` : `Código ${c.referralCode}`)}
        ${kpi('Clube Pet', d.club?.status === 'active' ? 'Assinante' : d.club?.status === 'pending' ? 'Pendente' : 'Não assina', d.club?.renewsAt ? `Renova em ${fmtDate(d.club.renewsAt)}` : '')}
      </div>
      <div class="adm-grid adm-grid--2">
        <section class="adm-card"><h2>${raw(icon('paw', 20))}Pets</h2>
          ${d.pets.map((p) => html`<div class="adm-line">${raw(petAvatar(p))}<div class="grow"><b>${p.name}</b> · ${p.breedName}<br />
            <span class="small muted">Ração: ${p.ration ? p.ration.name : 'ainda não comprada na loja'} · ${p.dailyGrams} g/dia · compra ${p.monthlyPurchaseKg} kg/mês</span></div>
            <span class="badge badge--${p.stock.level}">${LEVEL[p.stock.level]} · ${Math.max(0, Math.floor(p.stock.daysLeft))} dias</span></div>`)}
          <p class="small muted" style="margin-top:8px">${c.email} · WhatsApp ${c.whatsapp ?? '—'}${c.consentAt ? ` · autorizou contato em ${fmtDate(c.consentAt)}` : ''}</p>
        </section>
        <section class="adm-card"><h2>${raw(icon('calendar', 20))}Cuidados <button class="btn btn--sm btn--soft" style="margin-left:auto" data-add-care>Registrar data</button></h2>
          ${d.care.length ? d.care.slice(0, 8).map((e) => html`<div class="adm-line"><span class="grow"><b>${e.title}</b> · ${e.petName}<br /><span class="small muted">${e.source === 'loja' ? 'Registrado pela loja' : 'Cadastrado pelo tutor'}${e.repeatDays ? ` · repete a cada ${e.repeatDays} dias` : ''}</span></span>
            <span class="small">${fmtDate(e.dueAt)}${e.doneAt ? ' ✓' : ''}</span></div>`) : html`<p class="adm-empty">Sem datas cadastradas.</p>`}</section>
        <section class="adm-card" style="grid-column:1/-1"><h2>${raw(icon('receipt', 20))}Histórico de compras</h2>
          <div class="adm-table-wrap"><table class="adm-table"><thead><tr><th>Pedido</th><th>Data</th><th>Itens</th><th>Origem</th><th>Situação</th><th class="num">Total</th><th class="num">Pontos</th></tr></thead>
          <tbody>${d.orders.map((o) => html`<tr><td>#${o.id}</td><td>${fmtDate(o.createdAt)}</td><td>${o.items.map((l) => `${l.qty}× ${l.name}`).join(', ')}</td><td>${o.source === 'app' ? 'App' : 'Loja'}</td>
            <td><span class="badge badge--${o.status}">${{ requested: 'Aguardando', confirmed: 'Confirmado', cancelled: 'Cancelado' }[o.status]}</span></td><td class="num">${brl(o.totalCents)}</td><td class="num">${o.pointsEarned}</td></tr>`)}</tbody></table></div>
          ${d.orders.length ? '' : html`<p class="adm-empty">Nenhuma compra registrada.</p>`}</section>
      </div></div>`,
    mount(main) {
      main.querySelector('[data-open]')?.addEventListener('click', (e) => openWhatsApp(e.currentTarget.dataset.open));
      main.querySelector('[data-add-care]')?.addEventListener('click', () => {
        sheet(html`<form class="stack" novalidate><h2>Registrar data de cuidado</h2>
          <p class="small muted">Use a data informada pelo veterinário ou pela clínica. O app só lembra o tutor.</p>
          <div class="field"><label class="field__label" for="f-pet">Pet</label><div class="control"><select class="input" id="f-pet" name="petId">${d.pets.map((p) => html`<option value="${p.id}">${p.name}</option>`)}</select></div></div>
          <div class="field"><label class="field__label" for="f-kind">Tipo</label><div class="control"><select class="input" id="f-kind" name="kind">${Object.entries(CARE_KINDS).map(([k, l]) => html`<option value="${k}">${l}</option>`)}</select></div></div>
          ${field('title', 'Descrição', control({ name: 'title', placeholder: 'Ex.: Vacina V10' }))}
          ${field('dueAt', 'Data', html`<div class="control"><input class="control__input" id="f-dueAt" type="date" name="dueAt" /></div>`)}
          ${field('repeatDays', 'Repetir a cada (dias, opcional)', control({ name: 'repeatDays', inputmode: 'numeric', placeholder: 'Ex.: 365' }))}
          <button class="btn btn--block" type="submit">Salvar</button><button class="btn btn--ghost btn--block" type="button" data-close>Cancelar</button></form>`.toString(), {
          onMount(el, close) {
            const form = el.querySelector('form');
            form.addEventListener('submit', (e) => { e.preventDefault(); busy(form.querySelector('[type=submit]'), async () => {
              try {
                await call('POST', '/care', { petId: Number(form.petId.value), kind: form.kind.value, title: form.title.value, dueAt: form.dueAt.value ? `${form.dueAt.value}T09:00:00` : '', repeatDays: form.repeatDays.value || undefined });
                close(); toast('Data registrada. O tutor será lembrado.'); refresh();
              } catch (err) { showError(form, err); }
            }); });
          },
        });
      });
    },
  };
}
