import { api, getToken } from './api.js';
import { logoVerticalSvg } from './brand.js';
import { icon } from './icons.js';
import { artError } from './art.js';
import { html, raw } from './util.js';
import { toast } from './ui.js';
import * as onboarding from './views/onboarding.js';
import * as auth from './views/auth.js';
import * as home from './views/home.js';
import * as pet from './views/pet.js';
import * as petForm from './views/pet-form.js';
import * as alerts from './views/alerts.js';
import * as account from './views/account.js';
import * as shop from './views/shop.js';
import * as orders from './views/orders.js';
import * as club from './views/club.js';
import * as points from './views/points.js';
import * as care from './views/care.js';

const app = { config: null, me: null };
const root = document.getElementById('app');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- abertura animada ----------

function splash() {
  try {
    if (sessionStorage.getItem('petlee.splash')) return;
    sessionStorage.setItem('petlee.splash', '1');
  } catch {
    /* sem armazenamento: mostra sempre */
  }
  const el = document.createElement('div');
  el.className = 'splash';
  el.innerHTML = `<div class="splash__logo">${logoVerticalSvg()}</div><p class="splash__tag">Cuidando da ração do seu melhor amigo</p>`;
  document.body.append(el);

  const leave = () => {
    el.classList.add('splash--out');
    setTimeout(() => el.remove(), 550);
  };
  const timer = setTimeout(leave, reducedMotion ? 700 : 3000);
  el.addEventListener('click', () => {
    clearTimeout(timer);
    leave();
  });
}

// ---------- navegação ----------

function tabbar(active) {
  const tab = (id, ic, href, label) =>
    html`<a class="tab" href="${href}" aria-label="${label}" ${active === id ? raw('aria-current="page"') : ''}>
      ${raw(icon(ic, 22))}<span>${label}</span>
    </a>`;
  return html`<div class="tabbar"><nav aria-label="Principal">
    ${tab('home', 'home', '#/', 'Início')}${tab('shop', 'cart', '#/loja', 'Loja')}${tab('care', 'calendar', '#/agenda', 'Agenda')}${tab('account', 'user', '#/conta', 'Conta')}
  </nav></div>`;
}

// [padrão da rota, tela, tipo]: 'public' (sem login), 'auth' (com login), 'any' (os dois)
const ROUTES = [
  [/^\/?$/, null, 'any'], // início: boas-vindas ou home, conforme o login
  [/^\/entrar$/, auth.login, 'public'],
  [/^\/cadastro$/, auth.register, 'public'],
  [/^\/senha\/esqueci$/, auth.forgot, 'public'],
  [/^\/senha\/redefinir$/, auth.reset, 'public'],
  [/^\/oauth$/, auth.oauthReturn, 'public'],
  [/^\/completar$/, auth.complete, 'auth'],
  [/^\/novo-pet$/, petForm.create, 'auth'],
  [/^\/pet\/(\d+)$/, pet.detail, 'auth'],
  [/^\/pet\/(\d+)\/editar$/, petForm.edit, 'auth'],
  [/^\/avisos$/, alerts.view, 'auth'],
  [/^\/conta$/, account.view, 'auth'],
  [/^\/loja$/, shop.view, 'auth'],
  [/^\/compras$/, orders.view, 'auth'],
  [/^\/clube$/, club.view, 'auth'],
  [/^\/pontos$/, points.view, 'auth'],
  [/^\/agenda$/, care.view, 'auth'],
];

function currentRoute() {
  const [path, query = ''] = (location.hash.replace(/^#/, '') || '/').split('?');
  return { path, query: new URLSearchParams(query) };
}

let renderId = 0;
const go = (to) => {
  location.hash = to;
};

async function render() {
  const id = ++renderId;
  const { path, query } = currentRoute();
  const loggedIn = !!getToken();

  const match = ROUTES.find(([pattern]) => pattern.test(path));
  if (!match) return go('#/');
  const [pattern, routeView, access] = match;
  let view = routeView;

  if (!view) view = loggedIn ? home.view : onboarding.landing;
  if (access === 'auth' && !loggedIn) return go('#/entrar');
  if (access === 'public' && loggedIn && !/^\/(oauth|senha\/redefinir)$/.test(path)) return go('#/');

  try {
    if (!app.config) app.config = await api.config();
    if (loggedIn && (access === 'auth' || view === home.view)) {
      app.me = await api.me();
      // Cadastro com Google/Facebook ainda sem WhatsApp: precisa completar antes de usar o app.
      if (!app.me.customer.profileComplete && path !== '/completar' && path !== '/conta') return go('#/completar');
    }
    const params = pattern.exec(path).slice(1);
    const result = await view({ app, params, query, navigate: go, refresh: render });
    if (id !== renderId) return; // o usuário já foi para outra tela

    root.innerHTML = `<main class="page ${result.bare ? 'page--bare' : ''}">${result.body}</main>${result.tab ? tabbar(result.tab) : ''}`;
    if (result.fab) root.insertAdjacentHTML('beforeend', result.fab.toString());
    window.scrollTo(0, 0);
    result.mount?.(root);
  } catch (err) {
    if (id !== renderId) return;
    root.innerHTML = html`<main class="page empty stack">
      ${raw(artError())}
      <h2>Ops, algo deu errado</h2>
      <p>${err.message}</p>
      <button class="btn" id="retry">Tentar de novo</button>
    </main>`.toString();
    document.getElementById('retry').onclick = render;
    if (err.status) toast(err.message);
  }
}

window.addEventListener('hashchange', render);
splash();
render();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
