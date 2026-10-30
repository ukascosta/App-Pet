// Prepara a página do app dentro da moldura: aplica o cenário pedido pela moldura, troca o fetch pelo
// servidor simulado e simula o login com Google/Facebook. Precisa rodar ANTES do código do app.

import { STORE, advanceDays, applyScenario, handle, socialLogin } from './mock-backend.js';

/** Pedido da moldura (cenário, tela, qual página abrir). Lido uma vez: recarregar a página não repete o cenário. */
export const boot = (() => {
  try {
    const b = window.parent.__PETLEE_BOOT;
    window.parent.__PETLEE_BOOT = null;
    return b ?? {};
  } catch {
    return {};
  }
})();

const session = (k, v) => { try { v === null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch { /* ok */ } };
const local = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ok */ } };

const startHash = applyScenario(boot.scenario ?? 'keep');
if (boot.splash === true) session('petlee.splash', null);
else if (boot.splash === false || (boot.scenario && boot.scenario !== 'keep')) session('petlee.splash', '1');
if (boot.doc === 'loja' && boot.autoLogin) local('petlee.storekey', STORE.key);
if (boot.hash || startHash) location.hash = boot.hash ?? startHash;

// ---------- API simulada no lugar da rede ----------
const realFetch = window.fetch.bind(window);
window.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url, 'http://preview.local');
  if (!url.pathname.startsWith('/api/')) return realFetch(input, init);

  const headers = {};
  new Headers(init.headers).forEach((v, k) => (headers[k.toLowerCase()] = v));
  let body;
  try { body = init.body ? JSON.parse(init.body) : undefined; } catch { body = undefined; }

  await new Promise((r) => setTimeout(r, 140)); // um respiro, como numa rede de verdade
  const res = handle((init.method ?? 'GET').toUpperCase(), url.pathname.slice(4), url.searchParams, body, headers);
  return new Response(res.status === 204 ? null : JSON.stringify(res.body), { status: res.status, headers: { 'Content-Type': 'application/json' } });
};

// ---------- botões "Google" e "Facebook": simulação, sem sair da página ----------
document.addEventListener(
  'click',
  (e) => {
    const btn = e.target.closest?.('[data-social]');
    if (!btn) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    const provider = btn.dataset.social;
    const label = provider === 'google' ? 'Google' : 'Facebook';
    const who = provider === 'google' ? 'Ana Souza (ana@gmail.com)' : 'Caio Lima (caio@outlook.com)';

    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="stack">
      <span class="eyebrow">Simulação · Entrar com ${label}</span>
      <h2>Escolha uma conta</h2>
      <p class="muted small">Esta pré-visualização não se conecta ao ${label}. Escolha o que deve acontecer:</p>
      <button class="btn btn--block" data-pick="ok">Continuar como ${who}</button>
      <button class="btn btn--soft btn--block" data-pick="cancel">Simular “cancelar” no ${label}</button>
      <button class="btn btn--ghost btn--block" data-pick="close">Fechar</button></div></div>`;
    overlay.addEventListener('click', (ev) => {
      const pick = ev.target.closest('[data-pick]')?.dataset.pick;
      if (!pick && ev.target !== overlay) return;
      overlay.remove();
      if (pick === 'ok') location.hash = `#/oauth?code=${socialLogin(provider)}`;
      if (pick === 'cancel') location.hash = '#/entrar?erro=cancelado';
    });
    document.body.append(overlay);
  },
  true,
);

// usado pela moldura (viagem no tempo)
window.__preview = { advance: advanceDays };
