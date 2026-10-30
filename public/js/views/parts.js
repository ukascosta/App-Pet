// Peças compartilhadas entre as telas: anel de progresso, cartão de pet, cartão de destaque.

import { icon } from '../icons.js';
import { petAvatar } from '../art.js';
import { fmtAge, fmtDate, fmtDays, fmtGrams, fmtIn, fmtKg, html, nextMeal, raw } from '../util.js';

export const LEVEL = { ok: 'Em dia', low: 'Acabando', empty: 'Acabou' };

export function ring({ pct, level, size = 150, value, caption }) {
  return html`<div class="ring ring--${level}" style="--p:${pct};--size:${size}px" role="img" aria-label="${value} ${caption}">
    <svg viewBox="0 0 100 100" aria-hidden="true"><circle class="track" cx="50" cy="50" r="42" pathLength="1" /><circle class="value" cx="50" cy="50" r="42" pathLength="1" /></svg>
    <div class="label"><b>${value}</b><span>${caption}</span></div>
  </div>`;
}

export const daysOf = (pet) => Math.max(0, Math.floor(pet.stock.daysLeft));

export function runsOutLabel(pet) {
  return pet.stock.level === 'empty' ? 'Acabou' : fmtDate(pet.stock.runsOutAt);
}

/** Cartão preto de destaque com o anel de dias restantes. */
export function heroCard(p, { eyebrow = 'Ração de hoje', actions = '' } = {}) {
  const days = daysOf(p);
  return html`<section class="card card--dark stack">
    <div class="row">
      ${raw(petAvatar(p))}
      <div class="grow">
        <div class="eyebrow">${eyebrow}</div>
        <h2>${p.name}</h2>
        <div class="muted small">${p.breedName} · ${fmtAge(p.ageMonths)}</div>
      </div>
      <span class="badge badge--${p.stock.level}">${LEVEL[p.stock.level]}</span>
    </div>
    <div class="row" style="gap:20px;padding:6px 0">
      ${ring({ pct: p.stock.percent, level: p.stock.level, size: 142, value: days, caption: days === 1 ? 'dia de ração' : 'dias de ração' })}
      <div class="stat-list grow">
        <div class="stat"><b>${fmtKg(p.stock.kg)}</b><span>em casa agora</span></div>
        <div class="stat"><b>${runsOutLabel(p)}</b><span>previsão de término</span></div>
        <div class="stat"><b>${fmtGrams(p.dailyGrams)}</b><span>por dia</span></div>
      </div>
    </div>
    ${actions}
  </section>`;
}

/** Linha "Próxima refeição" de um pet. */
export function nextMealLine(p) {
  const n = nextMeal(p.mealTimes);
  return html`<div class="next-meal">${raw(icon('clock', 17))}<span>Próxima refeição às ${n.time} (${fmtIn(n.inMin)}) · ${fmtGrams(p.mealGrams)}</span></div>`;
}

export function petCard(p) {
  const { stock } = p;
  const when = stock.level === 'empty' ? 'A ração acabou' : `Acaba em ${fmtDate(stock.runsOutAt)}`;
  return html`<a class="card pet-card ${stock.level === 'low' ? 'card--alert' : stock.level === 'empty' ? 'card--empty' : ''}" href="#/pet/${p.id}">
    <div class="row">
      ${raw(petAvatar(p))}
      <div class="grow">
        <h3>${p.name}</h3>
        <div class="muted small">${p.breedName} · ${fmtAge(p.ageMonths)}</div>
      </div>
      <span class="badge badge--${stock.level}">${stock.level === 'empty' ? 'Acabou' : fmtDays(stock.daysLeft)}</span>
    </div>
    <div class="bar bar--${stock.level}" style="--p:${stock.percent};margin-top:14px" role="img" aria-label="${Math.round(stock.percent * 100)}% da ração"><i></i></div>
    <div class="row small" style="justify-content:space-between;margin-top:8px"><b>${fmtKg(stock.kg)}</b><span class="muted">${when}</span></div>
    ${nextMealLine(p)}
  </a>`;
}
