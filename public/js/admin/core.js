// Núcleo do painel da loja: acesso com a senha da loja, chamadas à API e layout.

import { logoHorizontalSvg } from '../brand.js';
import { icon } from '../icons.js';
import { html, raw } from '../util.js';
import { toast } from '../ui.js';

const KEY = 'petlee.storekey';
let storeKey = null;
try {
  storeKey = localStorage.getItem(KEY);
} catch {
  /* sem armazenamento: pede a senha a cada visita */
}

export const getKey = () => storeKey;
export function setKey(value) {
  storeKey = value;
  try {
    if (value) localStorage.setItem(KEY, value);
    else localStorage.removeItem(KEY);
  } catch {
    /* ok */
  }
}

export class AdminError extends Error {
  constructor(status, message, field) {
    super(message);
    this.status = status;
    this.field = field;
  }
}

export async function call(method, path, body) {
  let res;
  try {
    res = await fetch(`/api/store${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-store-key': storeKey ?? '' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new AdminError(0, 'Sem conexão. Tente de novo.');
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401) setKey(null); // quem chamou decide: a tela de acesso mostra o erro, as páginas voltam ao acesso
    throw new AdminError(res.status, data?.error ?? 'Algo deu errado.', data?.field);
  }
  return data;
}

export const NAV = [
  ['painel', 'Painel', 'chart'],
  ['oportunidades', 'Oportunidades', 'target'],
  ['clientes', 'Clientes', 'users'],
  ['pedidos', 'Pedidos', 'receipt'],
  ['produtos', 'Produtos', 'box'],
  ['agenda', 'Agenda', 'calendar'],
  ['clube', 'Clube Pet', 'crown'],
  ['marketing', 'Pontos e campanhas', 'megaphone'],
  ['config', 'Configurações', 'sliders'],
];

export function layout(active, { title, actions = '', body, badges = {} }) {
  return html`<div class="adm">
    <aside class="adm-side">
      <a class="adm-logo" href="#/painel" aria-label="Painel">${raw(logoHorizontalSvg())}</a>
      <nav class="adm-nav" aria-label="Seções do painel">
        ${NAV.map(([id, label, ic]) => html`<a href="#/${id}" ${active === id ? raw('aria-current="page"') : ''}>${raw(icon(ic, 20))}<span>${label}</span>${badges[id] ? html`<i class="adm-count">${badges[id]}</i>` : ''}</a>`)}
      </nav>
      <button class="adm-out" data-logout type="button">${raw(icon('logout', 18))}Sair</button>
    </aside>
    <main class="adm-main">
      <header class="adm-head"><h1>${title}</h1><div class="adm-actions">${actions}</div></header>
      ${body}
    </main>
  </div>`;
}

export const kpi = (label, value, sub = '', tone = '') =>
  html`<div class="kpi ${tone ? `kpi--${tone}` : ''}"><span>${label}</span><b>${value}</b>${sub ? html`<small>${sub}</small>` : ''}</div>`;

export const waButton = (label = 'WhatsApp', attrs = '') => html`<button type="button" class="btn btn--sm adm-wa" ${raw(attrs)}>${raw(icon('chat', 17))}${label}</button>`;

/** Abre o WhatsApp com a mensagem (num link de verdade, que o navegador abre numa nova aba). */
export function openWhatsApp(link) {
  const a = Object.assign(document.createElement('a'), { href: link, target: '_blank', rel: 'noopener' });
  document.body.append(a);
  a.click();
  a.remove();
}

export const pct = (x) => `${Math.round(x * 100)}%`;
export const species = (s) => (s === 'cat' ? 'Gato' : s === 'dog' ? 'Cão' : 'Todos');
export { toast };
