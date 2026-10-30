// Painel da loja: pedidos de reposição gerados quando a ração de um cliente está acabando.

import { logoHorizontalSvg } from './brand.js';
import { petAvatar } from './art.js';
import { icon } from './icons.js';
import { control, field, toast } from './ui.js';
import { fmtDays, fmtKg, fmtWhen, html, raw } from './util.js';

const KEY = 'petlee.storekey';
const root = document.getElementById('app');
let storeKey = null;
try {
  storeKey = localStorage.getItem(KEY);
} catch {
  /* sem armazenamento: pede a senha a cada visita */
}
let filter = 'open';
let timer;

async function call(method, path, body) {
  const res = await fetch(`/api/store${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-store-key': storeKey ?? '' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.error ?? 'Erro inesperado.');
    err.status = res.status;
    throw err;
  }
  return data;
}

function loginScreen(message = '') {
  clearInterval(timer);
  root.innerHTML = html`<main class="page page--bare">
    <header class="auth-hero auth-hero--compact">
      <span class="logo">${raw(logoHorizontalSvg())}</span>
      <h1>Painel da loja</h1>
      <p>Veja quem está com a ração acabando.</p>
    </header>
    <div class="auth-card">
      <form class="stack" novalidate>
        ${field('key', 'Senha da loja', control({ name: 'key', type: 'password', icon: 'lock', autocomplete: 'current-password' }))}
        <span class="field__error" role="alert">${message}</span>
        <button class="btn btn--block" type="submit">Entrar</button>
      </form>
    </div>
  </main>`.toString();
  root.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    storeKey = e.target.key.value;
    load(true);
  });
}

const FILTERS = [['open', 'Para atender'], ['sold', 'Vendidos'], ['closed', 'Encerrados']];
const STATUS = { new: 'Novo', contacted: 'Contatado', sold: 'Vendido', closed: 'Encerrado' };

function deliveryLabel(d) {
  if (!d) return '';
  if (d.status === 'sent') return ['check', 'Aviso automático enviado ao WhatsApp da loja'];
  if (d.status === 'skipped') return ['info', 'WhatsApp automático desligado: atenda por aqui'];
  if (d.status === 'failed') return ['warn', `Aviso automático falhou (${d.error}). Atenda por aqui.`];
  return ['clock', `Enviando aviso automático${d.error ? ` (tentando de novo: ${d.error})` : ''}`];
}

function leadCard(l) {
  const open = l.status === 'new' || l.status === 'contacted';
  const delivery = deliveryLabel(l.delivery);
  return html`<article class="card stack ${l.kind === 'empty' ? 'card--empty' : 'card--alert'}" data-lead="${l.id}">
    <div class="row">
      ${raw(petAvatar({ species: l.pet.species, color: l.pet.color }))}
      <div class="grow">
        <h3>${l.customer.name}</h3>
        <div class="muted small"><span class="nowrap">${l.customer.whatsapp}</span> · ${l.customer.email}</div>
      </div>
      <span class="badge badge--${l.kind}">${l.kind === 'empty' ? 'Acabou' : 'Acabando'}</span>
    </div>
    <div class="tiles">
      <div class="tile"><b>${l.pet.name}</b><span>${l.pet.breed} · ${l.pet.color}</span></div>
      <div class="tile"><b>${l.kind === 'empty' ? 'Sem ração' : fmtDays(l.daysLeft)}</b><span>${fmtWhen(l.createdAt)}</span></div>
      <div class="tile"><b>${fmtKg(l.suggestedKg)}</b><span>compra mensal do cliente</span></div>
      <div class="tile"><b>${STATUS[l.status]}</b><span>situação</span></div>
    </div>
    ${delivery ? html`<p class="small muted row" style="gap:8px;align-items:flex-start">${raw(icon(delivery[0], 17))}<span>${delivery[1]}</span></p>` : ''}
    ${open
      ? html`<a class="btn btn--block" style="background:var(--mint)" href="${l.whatsappLink}" target="_blank" rel="noopener" data-contact>${raw(icon('chat', 20))}Chamar no WhatsApp</a>
          <div class="control"><input class="control__input" data-note placeholder="Anotação (ex.: pedido de 10 kg para sexta)" aria-label="Anotação" value="${l.note}" maxlength="300" /></div>
          <div class="row"><button class="btn btn--dark btn--sm grow" data-status="sold">Vendido</button><button class="btn btn--soft btn--sm grow" data-status="closed">Encerrar</button></div>`
      : l.note ? html`<p class="small">${raw(icon('pencil', 15))} ${l.note}</p>` : ''}
  </article>`;
}

async function load(first = false) {
  try {
    const data = await call('GET', `/leads?status=${filter}`);
    if (first) try { localStorage.setItem(KEY, storeKey); } catch { /* ok */ }
    draw(data);
    clearInterval(timer);
    // não recarrega enquanto alguém digita uma anotação
    timer = setInterval(() => !document.activeElement?.matches?.('[data-note]') && load(), 30_000);
  } catch (err) {
    if (err.status === 401) {
      try { localStorage.removeItem(KEY); } catch { /* ok */ }
      return loginScreen(first ? err.message : '');
    }
    toast(err.message);
  }
}

function draw({ store, counts, leads }) {
  const scrollY = window.scrollY;
  root.innerHTML = html`<main class="page" style="padding-bottom:40px">
    <header class="pagehead">
      <span class="logo" style="width:112px;display:block">${raw(logoHorizontalSvg())}</span>
      <div class="grow"></div>
      <button class="btn btn--sm btn--ghost" data-logout>${raw(icon('logout', 18))}Sair</button>
    </header>
    <section class="card card--dark stack" style="margin-bottom:18px">
      <div class="eyebrow">${store.name}</div>
      <div class="row"><b class="display" style="font-size:2.6rem">${counts.open}</b><span class="muted" style="font-weight:700">${counts.open === 1 ? 'cliente para atender' : 'clientes para atender'}</span></div>
    </section>
    <div class="chips" role="tablist" style="margin-bottom:16px">
      ${FILTERS.map(([id, label]) => html`<button class="chip" role="tab" data-filter="${id}" aria-pressed="${id === filter}">${label} (${counts[id]})</button>`)}
    </div>
    <div class="stack">
      ${leads.length ? leads.map(leadCard) : html`<p class="center muted" style="padding:36px 10px;font-weight:700">${filter === 'open' ? 'Nenhum cliente para atender agora. 🎉' : 'Nada por aqui.'}</p>`}
    </div>
    <details style="margin-top:26px"><summary>${raw(icon('next', 18))}Configuração</summary>
      <p class="small muted" style="margin:8px 4px 12px">Envia uma mensagem de teste para o WhatsApp da loja usando o provedor configurado no servidor.</p>
      <button class="btn btn--sm btn--soft" data-test>Enviar mensagem de teste</button>
    </details>
  </main>`.toString();
  window.scrollTo(0, scrollY);
}

root.addEventListener('click', async (e) => {
  const t = e.target;
  const card = t.closest('[data-lead]');
  const id = card?.dataset.lead;
  try {
    if (t.closest('[data-filter]')) {
      filter = t.closest('[data-filter]').dataset.filter;
      await load();
    } else if (t.closest('[data-logout]')) {
      try { localStorage.removeItem(KEY); } catch { /* ok */ }
      storeKey = null;
      loginScreen();
    } else if (t.closest('[data-contact]')) {
      // abre o WhatsApp (link normal) e já marca como contatado
      await call('PATCH', `/leads/${id}`, { status: 'contacted' });
      setTimeout(load, 400);
    } else if (t.closest('[data-status]')) {
      const note = card.querySelector('[data-note]')?.value;
      await call('PATCH', `/leads/${id}`, { status: t.closest('[data-status]').dataset.status, note });
      toast('Atualizado.');
      await load();
    } else if (t.closest('[data-test]')) {
      const res = await call('POST', '/test-whatsapp');
      toast(`Teste enviado (${res.provider}).`);
    }
  } catch (err) {
    toast(err.message);
  }
});

// A anotação é salva ao sair do campo.
root.addEventListener('change', async (e) => {
  const input = e.target.closest('[data-note]');
  if (!input) return;
  const id = input.closest('[data-lead]').dataset.lead;
  try {
    await call('PATCH', `/leads/${id}`, { note: input.value });
    toast('Anotação salva.');
  } catch (err) {
    toast(err.message);
  }
});

storeKey ? load(true) : loginScreen();
