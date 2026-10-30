// Estoque de ração em casa.
//
// Não existe "job que subtrai ração todo dia": guardamos o estoque medido em
// um instante (stock_g, stock_at) e o consumo diário (daily_g). O estoque de
// agora é sempre calculado, então a contagem regressiva é exata e contínua,
// mesmo que o servidor fique fora do ar.

import { DAY_MS } from './nutrition.js';

export function currentStockG(pet, now) {
  const elapsedDays = Math.max(0, (now - pet.stock_at) / DAY_MS);
  return Math.max(0, pet.stock_g - pet.daily_g * elapsedDays);
}

/** @returns {{stockG:number, daysLeft:number, runsOutAt:number, level:'ok'|'low'|'empty', percent:number}} */
export function stockStatus(pet, now) {
  const stockG = currentStockG(pet, now);
  const daysLeft = stockG / pet.daily_g;
  let level = 'ok';
  if (stockG <= 0) level = 'empty';
  else if (daysLeft <= pet.alert_days) level = 'low';

  return {
    stockG,
    daysLeft,
    runsOutAt: now + daysLeft * DAY_MS,
    level,
    // Barra de progresso: 100% = uma compra mensal inteira.
    percent: Math.max(0, Math.min(1, stockG / pet.monthly_purchase_g)),
  };
}

/** Grava o estoque "de agora" como novo ponto de partida. */
export function settle(pet, now) {
  return { ...pet, stock_g: currentStockG(pet, now), stock_at: now };
}
