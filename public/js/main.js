import { api, getToken } from './api.js';
import { html, raw } from './util.js';
import { toast } from './ui.js';
import * as welcome from './views/welcome.js';
import * as home from './views/home.js';
import * as pet from './views/pet.js';
import * as petForm from './views/pet-form.js';
import * as alerts from './views/alerts.js';
import * as account from './views/account.js';

const app = { config: null, me: null };
const root = document.getElementById('app');

const ICONS = {
  pets: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><ellipse cx="5.5" cy="11" rx="2" ry="2.8"/><ellipse cx="9.5" cy="6.5" rx="2" ry="2.8"/><ellipse cx="14.5" cy="6.5" rx="2" ry="2.8"/><ellipse cx="18.5" cy="11" rx="2" ry="2.8"/><path d="M12 11c-3 0-6 3.4-6 6.2 0 2 1.6 2.8 3.2 2.8 1.2 0 1.8-.5 2.8-.5s1.6.5 2.8.5c1.6 0 3.2-.8 3.2-2.8C18 14.4 15 11 12 11z"/></svg>',
  alerts: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
  account: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
};

function tabbar(active) {
  const unread = app.me?.unreadAlerts ?? 0;
  const tab = (id, href, label) =>
    html`<a class="tab" href="${href}" ${active === id ? raw('aria-current="page"') : ''}>
      ${raw(ICONS[id])}${label}${id === 'alerts' && unread ? html`<span class="dot" aria-label="${unread} novos">${unread}</span>` : ''}
    </a>`;
  return html`<div class="tabbar"><nav aria-label="Principal">
    ${tab('pets', '#/', 'Meus pets')}${tab('alerts', '#/avisos', 'Avisos')}${tab('account', '#/conta', 'Conta')}
  </nav></div>`;
}

// [padrão da rota, tela, exige login?]
const ROUTES = [
  [/^\/?$/, null, false], // tratado em resolve(): boas-vindas ou início
  [/^\/cadastro$/, welcome.register, false],
  [/^\/entrar$/, welcome.login, false],
  [/^\/novo-pet$/, petForm.create, true],
  [/^\/pet\/(\d+)$/, pet.detail, true],
  [/^\/pet\/(\d+)\/editar$/, petForm.edit, true],
  [/^\/avisos$/, alerts.view, true],
  [/^\/conta$/, account.view, true],
];

let renderId = 0;

async function render() {
  const id = ++renderId;
  const path = location.hash.replace(/^#/, '') || '/';
  const loggedIn = !!getToken();

  const match = ROUTES.find(([pattern]) => pattern.test(path));
  if (!match) return (location.hash = '#/');
  const [re, routeView, needsLogin] = match;
  let view = routeView;
  if (!view) view = loggedIn ? home.view : welcome.landing;
  if (needsLogin && !loggedIn) return (location.hash = '#/entrar');
  if (!needsLogin && loggedIn && /^\/(cadastro|entrar)$/.test(path)) return (location.hash = '#/');

  try {
    if (!app.config) app.config = await api.config();
    if (loggedIn && (needsLogin || view === home.view)) app.me = await api.me();
    const params = re.exec(path).slice(1);
    const result = await view({ app, params, navigate: (to) => (location.hash = to), refresh: render });
    if (id !== renderId) return; // o usuário já foi para outra tela

    root.innerHTML = `<main class="page">${result.body}</main>${result.tab ? tabbar(result.tab) : ''}`;
    window.scrollTo(0, 0);
    result.mount?.(root);
  } catch (err) {
    if (id !== renderId) return;
    root.innerHTML = html`<main class="page stack center"><h2>Ops!</h2><p class="muted">${err.message}</p><button class="btn" id="retry">Tentar de novo</button></main>`.toString();
    document.getElementById('retry').onclick = render;
    if (err.status !== 0 && err.status !== undefined) toast(err.message);
  }
}

window.addEventListener('hashchange', render);
render();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
