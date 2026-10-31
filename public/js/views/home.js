import { api } from '../api.js';
import { artEmptyPets } from '../art.js';
import { icon } from '../icons.js';
import { fmtGrams, fmtIn, html, nextMeal, raw } from '../util.js';
import { heroCard, petCard } from './parts.js';
import { restockSheet } from './pet.js';
import { productCard, productSheet } from './shop.js';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
};

/** Refeições de hoje, de todos os pets, na ordem em que vão acontecer. */
function upcomingMeals(pets) {
  const now = new Date();
  const items = pets.flatMap((p) =>
    p.mealTimes.map((time) => {
      const n = nextMeal([time], now);
      return { pet: p, time, inMin: n.inMin };
    }),
  );
  return items.sort((a, b) => a.inMin - b.inMin).slice(0, 8);
}

export async function view({ app, refresh }) {
  const { customer, pets, unreadAlerts } = app.me;
  const summary = pets.length ? await api.summary().catch(() => null) : null;
  const first = customer.name.split(' ')[0];
  // O pet com menos dias de ração vai para o destaque.
  const urgent = [...pets].sort((a, b) => a.stock.daysLeft - b.stock.daysLeft)[0];
  const meals = upcomingMeals(pets);

  return {
    tab: 'home',
    fab: pets.length ? html`<a class="btn fab" href="#/novo-pet">${raw(icon('plus', 20))}Adicionar pet</a>` : '',
    body: html`
      <header class="pagehead">
        <div class="avatar-init" style="width:52px;height:52px;border-radius:18px;font-size:1.4rem" aria-hidden="true">${first[0].toUpperCase()}</div>
        <div class="grow">
          <div class="muted small" style="font-weight:700">${greeting()},</div>
          <h1 style="font-size:1.5rem">${first}</h1>
        </div>
        <a class="iconbtn" href="#/avisos" aria-label="Avisos${unreadAlerts ? ` (${unreadAlerts} novos)` : ''}">${raw(icon('bell', 22))}${unreadAlerts ? html`<i class="dot"></i>` : ''}</a>
      </header>
      ${summary ? html`<div class="chipbar" style="margin:-6px 0 18px">
        <a class="pill" href="#/pontos">${raw(icon('star', 16))}${summary.points} pontos</a>
        ${summary.member ? html`<a class="pill pill--dark" href="#/clube">${raw(icon('crown', 16))}Clube Pet</a>` : html`<a class="pill pill--mint" href="#/clube">${raw(icon('crown', 16))}${summary.pendingClub ? 'Assinatura em análise' : 'Conheça o Clube Pet'}</a>`}
        ${summary.pendingOrders ? html`<a class="pill" href="#/compras">${raw(icon('receipt', 16))}${summary.pendingOrders} pedido aguardando</a>` : ''}
      </div>` : ''}
      ${summary?.birthdayPets.length ? html`<div class="notice" style="margin-bottom:16px">${raw(icon('gift', 18))}<span>Mês de aniversário de ${summary.birthdayPets.join(' e ')}! Como você é do Clube Pet, tem um brinde esperando na loja.</span></div>` : ''}

      ${pets.length
        ? html`
          ${heroCard(urgent, {
            eyebrow: pets.length > 1 ? 'Acaba primeiro' : 'Ração de hoje',
            actions: html`<div class="row" style="gap:10px">
              <button class="btn grow" data-restock="${urgent.id}">Comprei ração</button>
              <a class="btn btn--on-dark" href="#/pet/${urgent.id}">Detalhes</a>
            </div>`,
          })}
          ${urgent.stock.level !== 'ok'
            ? html`<div class="notice notice--${urgent.stock.level === 'empty' ? 'danger' : 'warn'}" style="margin-top:14px" role="status">${raw(icon('warn', 18))}<span>A loja já foi avisada e vai falar com você pelo WhatsApp.</span></div>`
            : ''}

          ${summary?.picks.length ? html`<div class="section-title"><h2>Para seus pets</h2><a class="small" href="#/loja">Ver loja</a></div>
            <div class="shelf" data-picks>${summary.picks.map(productCard)}</div>` : ''}
          ${summary?.care.length ? html`<div class="section-title"><h2>Próximos cuidados</h2><a class="small" href="#/agenda">Agenda</a></div>
            <a class="card stack" href="#/agenda" style="text-decoration:none;color:inherit;font-weight:400">${summary.care.map((c) => html`<div class="row"><span class="badge badge--${c.status}">${c.status === 'late' ? 'Atrasado' : new Date(c.dueAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')}</span><span class="grow small"><b>${c.title}</b> · ${c.petName}</span></div>`)}</a>` : ''}

          <div class="section-title"><h2>Próximas refeições</h2></div>
          <div class="hscroll" aria-label="Próximas refeições">
            ${meals.map(
              (m, i) => html`<div class="meal-chip ${i === 0 ? 'meal-chip--next' : ''}">
                <span class="t">${raw(icon('bowl', 20))}</span>
                <div><time>${m.time}</time><small>${m.pet.name} · ${fmtGrams(m.pet.mealGrams)} · ${fmtIn(m.inMin)}</small></div>
              </div>`,
            )}
          </div>

          <div class="section-title"><h2>Meus pets</h2><span class="muted small">${pets.length} ${pets.length === 1 ? 'pet' : 'pets'}</span></div>
          <div class="stack">${pets.map(petCard)}</div>`
        : html`<section class="card empty">
            ${raw(artEmptyPets())}
            <h2>Nenhum pet por aqui ainda</h2>
            <p>Cadastre raça, idade e a ração que você compra. A gente cuida da contagem e dos horários.</p>
            <a class="btn" href="#/novo-pet">${raw(icon('plus', 20))}Cadastrar meu pet</a>
          </section>`}`,
    mount(root) {
      root.querySelector('[data-picks]')?.addEventListener('click', (e) => {
        const card = e.target.closest('[data-product]');
        if (card) productSheet(summary.picks.find((x) => x.id === Number(card.dataset.product)), { pets, member: summary.member });
      });
      root.querySelectorAll('[data-restock]').forEach((btn) =>
        btn.addEventListener('click', () => restockSheet(pets.find((p) => p.id === Number(btn.dataset.restock)), refresh)),
      );
    },
  };
}
