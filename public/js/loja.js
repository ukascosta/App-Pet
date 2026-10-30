// Painel da loja: pedidos de reposição gerados quando a ração de um cliente está acabando.

import { html, fmtDays, fmtKg, fmtWhen, speciesEmoji } from './util.js';
import { toast } from './ui.js';

const KEY = 'apppet.storekey';
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
  root.innerHTML = html`<main class="page stack">
    <div class="hero"><div class="art" aria-hidden="true">🏪</div><h1>Painel da loja</h1><p class="muted">Entre com a senha da loja para ver os clientes que precisam de ração.</p></div>
    <form class="stack" novalidate>
      <label class="field"><span class="label">Senha</span><input class="input ${message ? 'invalid' : ''}" type="password" name="key" autocomplete="current-password" required /><span class="error" role="alert">${message}</span></label>
      <button class="btn block" type="submit">Entrar</button>
    </form>
  </main>`.toString();
  root.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    storeKey = e.target.key.value;
    load(true);
  });
}

const FILTERS = [['open', 'Para atender'], ['sold', 'Vendidos'], ['closed', 'Encerrados']];
const KIND = { low: ['low', 'Acabando'], empty: ['empty', 'Acabou'] };

function deliveryLabel(d) {
  if (!d) return '';
  if (d.status === 'sent') return '✅ Aviso automático enviado ao WhatsApp da loja';
  if (d.status === 'skipped') return 'ℹ️ WhatsApp automático desligado: atenda por aqui';
  if (d.status === 'failed') return `⚠️ Aviso automático falhou (${d.error}). Atenda por aqui.`;
  return `⏳ Enviando aviso automático${d.error ? ` (tentando de novo: ${d.error})` : ''}`;
}

function leadCard(l) {
  const [cls, label] = KIND[l.kind];
  const open = l.status === 'new' || l.status === 'contacted';
  return html`<article class="card stack ${l.kind === 'empty' ? 'empty' : 'low'}" data-lead="${l.id}">
    <div class="row">
      <div class="avatar ${l.pet.species}" aria-hidden="true">${speciesEmoji(l.pet.species)}</div>
      <div class="grow">
        <h3>${l.customer.name}</h3>
        <div class="muted small"><span style="white-space:nowrap">${l.customer.whatsapp}</span> · ${l.customer.email}</div>
      </div>
      <span class="badge ${cls}">${label}</span>
    </div>
    <div class="stats">
      <div class="stat"><b>${l.pet.name}</b><span>${l.pet.breed} · ${l.pet.color}</span></div>
      <div class="stat"><b>${l.kind === 'empty' ? 'Sem ração' : fmtDays(l.daysLeft)}</b><span>${fmtWhen(l.createdAt)}</span></div>
      <div class="stat"><b>${fmtKg(l.suggestedKg)}</b><span>compra mensal do cliente</span></div>
      <div class="stat"><b>${l.status === 'contacted' ? 'Contatado' : l.status === 'new' ? 'Novo' : l.status === 'sold' ? 'Vendido' : 'Encerrado'}</b><span>situação</span></div>
    </div>
    <p class="small muted">${deliveryLabel(l.delivery)}</p>
    ${open
      ? html`<a class="btn accent block" href="${l.whatsappLink}" target="_blank" rel="noopener" data-contact>💬 Chamar no WhatsApp</a>
          <label class="field"><span class="sr-only">Anotação</span><input class="input" data-note placeholder="Anotação (ex.: pedido de 10 kg para sexta)" value="${l.note}" maxlength="300" /></label>
          <div class="input-row"><button class="btn small" data-status="sold">Vendido</button><button class="btn small secondary" data-status="closed">Encerrar</button></div>`
      : l.note ? html`<p class="small">📝 ${l.note}</p>` : ''}
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
  root.innerHTML = html`<main class="page">
    <header class="row" style="margin-bottom:6px"><div class="grow"><h1>${store.name}</h1><p class="muted">Clientes com a ração acabando</p></div><button class="btn small ghost" data-logout>Sair</button></header>
    <div class="chips" role="tablist" style="margin:14px 0">
      ${FILTERS.map(([id, label]) => html`<button class="chip" role="tab" data-filter="${id}" aria-pressed="${id === filter}">${label} (${counts[id]})</button>`)}
    </div>
    <div class="stack">
      ${leads.length ? leads.map(leadCard) : html`<p class="center muted" style="padding:36px 10px">${filter === 'open' ? 'Nenhum cliente para atender agora. 🎉' : 'Nada por aqui.'}</p>`}
    </div>
    <details style="margin-top:26px"><summary>Configuração</summary>
      <p class="small muted" style="margin:8px 0">Envia uma mensagem de teste para o WhatsApp da loja usando o provedor configurado no servidor.</p>
      <button class="btn small secondary" data-test>Enviar mensagem de teste</button>
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
