import { html, fmtAge, fmtDays, fmtDate, fmtKg, speciesEmoji } from '../util.js';
import { restockSheet } from './pet.js';

const LEVEL_LABEL = { ok: 'Em dia', low: 'Acabando', empty: 'Acabou' };

export function petCard(p) {
  const { stock } = p;
  const when =
    stock.level === 'empty'
      ? 'A ração acabou'
      : `Restam ${fmtDays(stock.daysLeft)} · acaba em ${fmtDate(stock.runsOutAt)}`;
  return html`<article class="card ${stock.level === 'ok' ? '' : stock.level}">
    <a class="row" href="#/pet/${p.id}" style="text-decoration:none;color:inherit">
      <div class="avatar ${p.species}" aria-hidden="true">${speciesEmoji(p.species)}</div>
      <div class="grow">
        <h3>${p.name}</h3>
        <div class="muted small">${p.breedName} · ${fmtAge(p.ageMonths)}</div>
      </div>
      <span class="badge ${stock.level}">${LEVEL_LABEL[stock.level]}</span>
    </a>
    <div class="progress ${stock.level}" style="--p:${stock.percent};margin:14px 0 8px" role="img" aria-label="${Math.round(stock.percent * 100)}% da ração"><i></i></div>
    <div class="row">
      <div class="grow small"><b>${when}</b><br /><span class="muted">${fmtKg(stock.kg)} em casa</span></div>
      <button class="btn small ${stock.level === 'ok' ? 'secondary' : ''}" data-restock="${p.id}">Comprei ração</button>
    </div>
  </article>`;
}

export async function view({ app, refresh }) {
  const { customer, pets } = app.me;
  const urgent = pets.filter((p) => p.stock.level !== 'ok');
  const first = customer.name.split(' ')[0];

  return {
    tab: 'pets',
    body: html`
      <header style="margin-bottom:18px">
        <h1>Olá, ${first} 👋</h1>
        <p class="muted">${pets.length ? 'Veja como está a ração dos seus pets.' : 'Vamos cadastrar o seu primeiro pet?'}</p>
      </header>
      ${urgent.length
        ? html`<div class="notice ${urgent.some((p) => p.stock.level === 'empty') ? 'danger' : 'warn'}" style="margin-bottom:16px" role="status">
            ${urgent.length === 1 ? `A ração de ${urgent[0].name}` : `A ração de ${urgent.length} pets`} precisa de reposição.
            A loja já foi avisada e vai falar com você pelo WhatsApp.
          </div>`
        : ''}
      <div class="stack">
        ${pets.length
          ? pets.map(petCard)
          : html`<div class="card center stack">
              <div style="font-size:3rem" aria-hidden="true">🐾</div>
              <h2>Nenhum pet por aqui ainda</h2>
              <p class="muted">Cadastre raça, idade e a ração que você compra. A gente cuida da contagem.</p>
              <a class="btn" href="#/novo-pet">Cadastrar meu pet</a>
            </div>`}
      </div>
      ${pets.length ? html`<a class="btn fab" href="#/novo-pet" aria-label="Adicionar pet">＋ Adicionar pet</a>` : ''}`,
    mount(root) {
      // Os botões são novos a cada renderização; não registrar nada no #app, que é sempre o mesmo elemento.
      root.querySelectorAll('[data-restock]').forEach((btn) => {
        btn.addEventListener('click', () => {
          restockSheet(pets.find((x) => x.id === Number(btn.dataset.restock)), refresh);
        });
      });
    },
  };
}
