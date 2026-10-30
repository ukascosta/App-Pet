// Moldura da pré-visualização: controla o app dentro do celular (cenários, telas, tempo, mensagens, tarefas e notas).

import { logoHorizontalSvg } from '../../public/js/brand.js';

const DOC = JSON.parse(document.getElementById('app-doc').textContent);
const $ = (s, r = document) => r.querySelector(s);
const el = (tag, props = {}, ...kids) => {
  const n = document.createElement(tag);
  // aria-* e role são atributos; o resto são propriedades do elemento
  for (const [k, v] of Object.entries(props)) (k.includes('-') || k === 'role' ? n.setAttribute(k, v) : (n[k] = v));
  n.append(...kids.filter((k) => k !== null && k !== undefined));
  return n;
};
const memory = {}; // reserva quando o navegador bloqueia o localStorage
const store = {
  get(k, fallback) {
    try {
      return JSON.parse(localStorage.getItem(k)) ?? (k in memory ? memory[k] : fallback);
    } catch {
      return k in memory ? memory[k] : fallback;
    }
  },
  set(k, v) {
    memory[k] = v;
    try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ok */ }
  },
};
let snapshot = null; // estado mais recente enviado pelo app (mensagens e relógio)
const appState = () => snapshot ?? store.get(K.state, {});
const K = { state: 'petlee.preview.state', notes: 'petlee.preview.notes', tasks: 'petlee.preview.tasks', seen: 'petlee.preview.seen', size: 'petlee.preview.size' };

const SIZES = { m: { label: 'Celular', w: 390, h: 844 }, s: { label: 'Pequeno', w: 320, h: 640 }, l: { label: 'Grande', w: 430, h: 932 } };
const SCENARIOS = [
  ['zero', 'Conta nova', 'Boas-vindas e nada cadastrado'],
  ['login', 'Já tenho conta', 'Tela de login com a conta de exemplo'],
  ['logado-vazio', 'Logada, sem pets', 'Início vazio, pronto para cadastrar'],
  ['dois-pets', 'Tutora com 2 pets', 'Thor (cão) e Mia (gata)'],
  ['acabando', 'Ração acabando', 'Mia com 3 dias; a loja já foi avisada'],
  ['acabou', 'Ração acabou', 'Thor sem ração; aviso urgente'],
  ['social', 'Login com Google', 'Conta nova sem WhatsApp'],
];
const SCREENS = [
  ['Entrada', [
    ['Abertura animada', { scenario: 'zero', splash: true }],
    ['Boas-vindas', { scenario: 'zero' }],
    ['Entrar', { scenario: 'login' }],
    ['Criar conta', { scenario: 'zero', hash: '#/cadastro' }],
    ['Esqueci a senha', { scenario: 'login', hash: '#/senha/esqueci' }],
    ['Completar cadastro', { scenario: 'social' }],
  ]],
  ['Pets', [
    ['Início sem pets', { scenario: 'logado-vazio' }],
    ['Início com pets', { scenario: 'dois-pets' }],
    ['Cadastrar pet', { scenario: 'logado-vazio', hash: '#/novo-pet' }],
    ['Detalhe do pet', { scenario: 'dois-pets', hash: '#/pet/1' }],
    ['Editar pet', { scenario: 'dois-pets', hash: '#/pet/1/editar' }],
    ['Ração acabando', { scenario: 'acabando', hash: '#/pet/2' }],
    ['Ração acabou', { scenario: 'acabou', hash: '#/pet/1' }],
  ]],
  ['Avisos e conta', [
    ['Avisos vazios', { scenario: 'dois-pets', hash: '#/avisos' }],
    ['Avisos com alerta', { scenario: 'acabando', hash: '#/avisos' }],
    ['Conta', { scenario: 'dois-pets', hash: '#/conta' }],
  ]],
  ['Loja', [
    ['Painel: login', { scenario: 'acabando', doc: 'loja' }],
    ['Painel: atendendo', { scenario: 'acabando', doc: 'loja', autoLogin: true }],
  ]],
];
const TASKS = [
  ['t1', 'Criar uma conta e cadastrar o primeiro pet', 'Observe se ficou claro o que preencher em cada passo e quanto tempo levou.', { scenario: 'zero' }],
  ['t2', 'Descobrir em que dia a ração do Thor acaba', 'Quantos toques até achar a data? A informação estava onde você esperava?', { scenario: 'dois-pets' }],
  ['t3', 'Registrar que comprou ração para a Mia', 'O botão foi fácil de achar? O resultado ficou claro depois de salvar?', { scenario: 'acabando' }],
  ['t4', 'Mudar os horários das refeições da Mia', 'Entendeu a diferença entre a sugestão e a sua rotina?', { scenario: 'dois-pets', hash: '#/pet/2/editar' }],
  ['t5', 'Recuperar a senha esquecida', 'Peça o link e abra o e-mail na aba Mensagens.', { scenario: 'login', hash: '#/senha/esqueci' }],
  ['t6', 'Entrar com o Google e completar o cadastro', 'Ficou claro por que pedimos o WhatsApp?', { scenario: 'login' }],
  ['t7', 'Avançar 7 dias e ver o aviso de ração acabando', 'Use a Viagem no tempo. O aviso chegou onde e quando esperava?', { scenario: 'dois-pets' }],
  ['t8', 'Como loja: atender o cliente com ração acabando', 'Abra o painel, chame no WhatsApp e marque como vendido.', { scenario: 'acabando', doc: 'loja' }],
];
const TIME_STEPS = [[1, '+1 dia'], [3, '+3 dias'], [7, '+7 dias'], [14, '+14 dias'], [0, 'Hoje']];

const iframe = $('#screen');
let loaded = false;
let sizeId = store.get(K.size, 'm');
let currentDoc = 'app';

// ---------- carregar o app na moldura ----------
let ready = false;
let loads = 0;

/** Se a página do app não avisar que carregou, mostra um aviso (sem tentar outros caminhos que recarregam a tela). */
function watchLoad() {
  ready = false;
  setTimeout(() => {
    if (!ready) $('#blocked').hidden = false;
  }, 12000);
}

function launch(boot = {}) {
  window.__PETLEE_BOOT = { doc: 'app', scenario: 'keep', ...boot };
  currentDoc = window.__PETLEE_BOOT.doc;
  // Um comentário diferente a cada vez força o navegador a recarregar o conteúdo embutido.
  iframe.srcdoc = `${DOC}<!-- ${++loads} -->`;
  if (!loaded) {
    loaded = true;
    watchLoad();
  }
  closePanels();
  renderDocs();
  refresh();
}

function goto(hash) {
  if (currentDoc !== 'app') return launch({ hash });
  iframe.contentWindow.location.hash = hash;
}

// ---------- painéis ----------
function renderScenarios() {
  $('#scenarios').replaceChildren(
    ...SCENARIOS.map(([id, title, text]) => {
      const b = el('button', { className: 'scn', type: 'button', onclick: () => launch({ scenario: id }) }, el('b', { textContent: title }), el('span', { textContent: text }));
      return b;
    }),
  );
}

function renderScreens() {
  $('#screens').replaceChildren(
    ...SCREENS.map(([group, items]) =>
      el('div', { className: 'group' }, el('h3', { textContent: group }),
        el('div', { className: 'links' }, ...items.map(([label, boot]) => el('button', { className: 'link', type: 'button', textContent: label, onclick: () => launch({ splash: false, ...boot }) })))),
    ),
  );
}

function renderTimeButtons() {
  $('#timeBtns').replaceChildren(
    ...TIME_STEPS.map(([days, label]) => el('button', { className: 'btn btn--sm ' + (days ? 'btn--dark' : 'btn--soft'), type: 'button', textContent: label, onclick: () => travel(days) })),
  );
}

function travel(days) {
  const api = iframe.contentWindow?.__preview;
  if (!api) return;
  api.advance(days);
  if (currentDoc === 'loja') launch({ doc: 'loja' });
  else iframe.contentWindow.dispatchEvent(new HashChangeEvent('hashchange'));
  refresh();
}

function renderSizes() {
  $('#sizes').replaceChildren(
    ...Object.entries(SIZES).map(([id, s]) => el('button', { type: 'button', textContent: s.label, 'aria-pressed': String(id === sizeId), onclick: () => { sizeId = id; store.set(K.size, id); renderSizes(); fit(); } })),
  );
}

function renderDocs() {
  $('#docs').replaceChildren(
    ...[['app', 'App do tutor'], ['loja', 'Painel da loja']].map(([id, label]) => el('button', { type: 'button', textContent: label, 'aria-pressed': String(id === currentDoc), onclick: () => launch({ doc: id, autoLogin: false }) })),
  );
}

function fit() {
  const small = matchMedia('(max-width: 900px)').matches;
  const wrap = $('#wrap');
  const phone = $('#phone');
  if (small) {
    wrap.style.cssText = phone.style.cssText = iframe.style.cssText = '';
    return;
  }
  const { w, h } = SIZES[sizeId];
  const bezel = 14;
  const fullW = w + bezel * 2;
  const fullH = h + bezel * 2;
  const room = innerHeight - $('.top').offsetHeight - $('.device__top').offsetHeight - 56;
  const scale = Math.min(1, room / fullH);
  phone.style.cssText = `width:${fullW}px;height:${fullH}px;transform:scale(${scale});transform-origin:top left`;
  wrap.style.cssText = `width:${fullW * scale}px;height:${fullH * scale}px`;
  iframe.style.cssText = `width:${w}px;height:${h}px`;
}

// ---------- mensagens simuladas ----------
const KIND = { whatsapp: 'WhatsApp para a loja', email: 'E-mail para o tutor', push: 'Push no celular' };
const hhmm = (t) => new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

function renderMail() {
  const mailbox = appState().mailbox ?? [];
  const pane = $('#tab-mail');
  if (!mailbox.length) {
    pane.replaceChildren(el('p', { className: 'empty', textContent: 'Ainda não saiu nenhuma mensagem. Quando a ração de um pet estiver acabando (ou você pedir uma nova senha), o que o app enviaria aparece aqui.' }));
  } else {
    pane.replaceChildren(
      el('p', { className: 'hint', textContent: 'É o que o tutor e a loja receberiam. Aqui nada é enviado de verdade.' }),
      ...mailbox.map((m) =>
        el('article', { className: `mail mail--${m.kind}` },
          el('div', { className: 'mail__head' }, el('span', { textContent: KIND[m.kind] }), el('span', { textContent: hhmm(m.at) })),
          el('div', { className: 'mail__title', textContent: m.title }),
          el('div', { className: 'mail__body', textContent: m.body }),
          m.hash ? el('button', { className: 'btn btn--sm ' + (m.kind === 'push' ? '' : 'btn--dark'), type: 'button', textContent: m.linkLabel ?? 'Abrir no app', onclick: () => { goto(m.hash); closePanels(); } }) : null,
        ),
      ),
    );
  }
  const seen = store.get(K.seen, 0);
  const unseen = mailbox.filter((m) => m.id > seen).length;
  const visible = !$('#tab-mail').hidden;
  if (visible && mailbox.length) store.set(K.seen, mailbox[0].id);
  setBadge(visible ? 0 : unseen);
}

function setBadge(n) {
  for (const b of [$('#badge'), $('#tabBadge')]) {
    if (!b) continue;
    b.hidden = !n;
    b.textContent = n;
  }
}

function renderClock() {
  const offset = appState().offsetMs ?? 0;
  const days = Math.round(offset / 86_400_000);
  const date = new Date(Date.now() + offset).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  $('#clock').replaceChildren(date, days ? el('small', { textContent: `+${days} ${days === 1 ? 'dia' : 'dias'}` }) : '');
}

function refresh() {
  renderClock();
  renderMail();
}

// ---------- tarefas e anotações ----------
function renderTasks() {
  const done = store.get(K.tasks, {});
  const total = Object.values(done).filter(Boolean).length;
  $('#tab-tasks').replaceChildren(
    el('p', { className: 'hint', textContent: 'Roteiro para testar o app com alguém. Peça para a pessoa pensar em voz alta e anote onde ela hesitou.' }),
    el('p', { className: 'progress', textContent: `${total} de ${TASKS.length} concluídas` }),
    ...TASKS.map(([id, title, hint, boot]) =>
      el('div', { className: 'task' + (done[id] ? ' done' : '') },
        el('input', { type: 'checkbox', checked: !!done[id], 'aria-label': `Concluída: ${title}`, onchange: (e) => { store.set(K.tasks, { ...store.get(K.tasks, {}), [id]: e.target.checked }); renderTasks(); } }),
        el('b', { textContent: title }),
        el('p', { textContent: hint }),
        el('button', { className: 'btn btn--sm btn--dark', type: 'button', textContent: 'Começar esta tarefa', onclick: () => launch({ splash: false, ...boot }) }),
      ),
    ),
  );
}

function renderNotes() {
  const area = el('textarea', { id: 'notes', value: store.get(K.notes, ''), placeholder: 'Ex.: Na tela de cadastro a pessoa não achou o botão de raça…', oninput: (e) => store.set(K.notes, e.target.value) });
  $('#tab-notes').replaceChildren(
    el('p', { className: 'hint', textContent: 'As anotações ficam salvas neste navegador.' }),
    area,
    el('div', { className: 'row' },
      el('button', { className: 'btn btn--sm btn--dark', type: 'button', textContent: 'Copiar tarefas e anotações', onclick: (e) => copyNotes(e.currentTarget) }),
      el('button', { className: 'btn btn--sm btn--soft', type: 'button', textContent: 'Limpar', onclick: () => { store.set(K.notes, ''); area.value = store.get(K.notes, ''); } }),
    ),
  );
}

function notesText() {
  const done = store.get(K.tasks, {});
  return [
    'PetLee: anotações da sessão de usabilidade',
    new Date().toLocaleString('pt-BR'),
    '',
    'Tarefas:',
    ...TASKS.map(([id, title]) => `  [${done[id] ? 'x' : ' '}] ${title}`),
    '',
    'Anotações:',
    store.get(K.notes, '') || '(vazio)',
    '',
  ].join('\n');
}

/** Copia tarefas e anotações. Se o visualizador recusar a área de transferência, deixa o texto selecionado para Ctrl+C. */
async function copyNotes(button) {
  const text = notesText();
  const area = $('#notes');
  const say = (msg) => { const old = button.textContent; button.textContent = msg; setTimeout(() => (button.textContent = old), 2200); };
  try {
    await navigator.clipboard.writeText(text);
    say('Copiado!');
  } catch {
    area.value = text;
    area.focus();
    area.select();
    say('Selecionado: use Ctrl+C');
  }
}

// ---------- abas e gavetas ----------
const TABS = [['mail', 'Mensagens'], ['tasks', 'Tarefas'], ['notes', 'Anotações']];
function showTab(id) {
  for (const [t] of TABS) $(`#tab-${t}`).hidden = t !== id;
  $('#tabs').querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === id)));
  if (id === 'mail') renderMail();
}

function renderTabs() {
  $('#tabs').replaceChildren(
    ...TABS.map(([id, label]) => {
      const b = el('button', { type: 'button', role: 'tab', textContent: label, onclick: () => showTab(id) });
      b.dataset.tab = id;
      if (id === 'mail') b.append(el('i', { className: 'count', id: 'tabBadge', hidden: true }));
      return b;
    }),
  );
}

const closePanels = () => {
  document.querySelectorAll('.panel.open').forEach((p) => p.classList.remove('open'));
  $('#scrim').hidden = true;
};
const openPanel = (id) => {
  closePanels();
  $(id).classList.add('open');
  $('#scrim').hidden = false;
};

// ---------- início ----------
$('#logo').innerHTML = logoHorizontalSvg();
renderScenarios();
renderScreens();
renderTimeButtons();
renderSizes();
renderTabs();
renderTasks();
renderNotes();
showTab('mail');
$('#openLeft').onclick = () => openPanel('#left');
$('#openRight').onclick = () => { openPanel('#right'); showTab('mail'); };
$('#scrim').onclick = closePanels;
document.querySelectorAll('[data-close]').forEach((b) => (b.onclick = closePanels));
$('#resetAll').onclick = () => launch({ scenario: 'zero', splash: true });
window.addEventListener('message', (e) => {
  if (e.data?.petlee === 'ready') {
    ready = true;
    $('#blocked').hidden = true;
  }
  if (e.data?.petlee === 'state') {
    snapshot = { mailbox: e.data.mailbox ?? [], offsetMs: e.data.offsetMs ?? 0 };
    refresh();
  }
});
window.addEventListener('resize', fit);
window.addEventListener('storage', () => { snapshot = null; refresh(); });
setInterval(renderClock, 30_000);
fit();
launch({ scenario: 'keep' });
