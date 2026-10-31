// Painel da loja: roteador e tela de acesso.

import { logoHorizontalSvg } from '../brand.js';
import { html, raw } from '../util.js';
import { busy, control, field } from '../ui.js';
import { call, getKey, layout, setKey } from './core.js';
import * as crm from './crm.js';
import * as sales from './sales.js';
import * as services from './services.js';
import * as marketing from './marketing.js';

const root = document.getElementById('app');
const ROUTES = [
  [/^\/(painel)?$/, 'painel', crm.dashboard],
  [/^\/oportunidades$/, 'oportunidades', crm.opportunities],
  [/^\/clientes$/, 'clientes', crm.customers],
  [/^\/clientes\/(\d+)$/, 'clientes', crm.customer],
  [/^\/pedidos$/, 'pedidos', sales.orders],
  [/^\/pedidos\/novo$/, 'pedidos', sales.newOrder],
  [/^\/produtos$/, 'produtos', sales.products],
  [/^\/agenda$/, 'agenda', services.agenda],
  [/^\/clube$/, 'clube', services.club],
  [/^\/marketing$/, 'marketing', marketing.marketing],
  [/^\/config$/, 'config', marketing.settings],
];

function loginScreen(message = '') {
  root.innerHTML = html`<div class="adm-login"><section class="adm-card stack">
    <span style="display:block;width:150px">${raw(logoHorizontalSvg())}</span>
    <h1 style="font-size:1.6rem">Painel da loja</h1>
    <p class="muted">Clientes, oportunidades de venda, pedidos, clube e agenda.</p>
    <form class="stack" novalidate>
      ${field('key', 'Senha da loja', control({ name: 'key', type: 'password', icon: 'lock', autocomplete: 'current-password' }))}
      <span class="field__error" role="alert">${message}</span>
      <button class="btn btn--block" type="submit">Entrar</button>
    </form></section></div>`.toString();
  const form = root.querySelector('form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    busy(form.querySelector('[type=submit]'), async () => {
      setKey(form.key.value);
      try {
        await call('GET', '/dashboard');
        location.hash = '#/painel';
        render();
      } catch (err) {
        setKey(null);
        loginScreen(err.status === 401 ? 'Senha incorreta.' : err.message);
      }
    });
  });
}

let renderId = 0;
let badges = {};
async function render() {
  const id = ++renderId;
  if (!getKey()) return loginScreen();
  const [path, q = ''] = (location.hash.replace(/^#/, '') || '/painel').split('?');
  const route = ROUTES.find(([re]) => re.test(path)) ?? ROUTES[0];
  const [re, active, page] = route;
  try {
    const result = await page({ params: re.exec(path)?.slice(1) ?? [], query: new URLSearchParams(q), refresh: render, navigate: (to) => (location.hash = to) });
    if (id !== renderId) return;
    root.innerHTML = layout(active, { ...result, badges }).toString();
    const main = root.querySelector('.adm-main');
    root.querySelector('[data-logout]').addEventListener('click', () => { setKey(null); loginScreen(); });
    result.mount?.(main);
    window.scrollTo(0, 0);
    refreshBadges();
  } catch (err) {
    if (id !== renderId) return;
    if (err.status === 401) return loginScreen('A senha da loja mudou ou expirou. Entre de novo.');
    root.innerHTML = layout(active, { title: 'Ops', body: html`<div class="adm-card"><p>${err.message}</p><button class="btn" id="retry">Tentar de novo</button></div>`, badges }).toString();
    document.getElementById('retry').onclick = render;
  }
}

/** Números na barra lateral: oportunidades abertas, pedidos do app e assinaturas pendentes. */
async function refreshBadges() {
  try {
    const d = await call('GET', '/dashboard');
    const next = { oportunidades: d.opportunitiesOpen, pedidos: d.metrics.pendingAppOrders, clube: d.metrics.pendingMembers };
    if (JSON.stringify(next) === JSON.stringify(badges)) return;
    badges = next;
    root.querySelectorAll('.adm-nav a').forEach((a) => {
      const key = a.getAttribute('href').slice(2);
      a.querySelector('.adm-count')?.remove();
      if (badges[key]) a.insertAdjacentHTML('beforeend', `<i class="adm-count">${badges[key]}</i>`);
    });
  } catch {
    /* os números são só um atalho */
  }
}

window.addEventListener('hashchange', render);
render();
