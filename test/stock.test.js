import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DAY_MS } from '../server/lib/nutrition.js';
import { settle, stockStatus } from '../server/lib/stock.js';

const T0 = Date.UTC(2026, 0, 1);
const pet = (over = {}) => ({ stock_g: 3000, stock_at: T0, daily_g: 300, monthly_purchase_g: 9000, alert_days: 3, ...over });

test('o estoque diminui sozinho com o passar dos dias', () => {
  const s = stockStatus(pet(), T0 + 4 * DAY_MS);
  assert.equal(Math.round(s.stockG), 1800);
  assert.equal(Math.round(s.daysLeft * 10) / 10, 6);
  assert.equal(s.level, 'ok');
});

test('passa para "acabando" quando restam alert_days dias ou menos', () => {
  assert.equal(stockStatus(pet(), T0 + 6 * DAY_MS).level, 'ok'); // 4 dias restantes
  assert.equal(stockStatus(pet(), T0 + 7 * DAY_MS).level, 'low'); // exatamente 3 dias
  assert.equal(stockStatus(pet(), T0 + 9.5 * DAY_MS).level, 'low');
});

test('acaba e nunca fica negativo', () => {
  const s = stockStatus(pet(), T0 + 30 * DAY_MS);
  assert.equal(s.stockG, 0);
  assert.equal(s.level, 'empty');
  assert.equal(s.percent, 0);
});

test('previsão de término e barra de progresso', () => {
  const s = stockStatus(pet(), T0);
  assert.equal(s.runsOutAt, T0 + 10 * DAY_MS);
  assert.ok(Math.abs(s.percent - 1 / 3) < 1e-9);
  assert.equal(stockStatus(pet({ stock_g: 20000 }), T0).percent, 1);
});

test('settle fixa o estoque de agora sem mudar a previsão', () => {
  const later = T0 + 2 * DAY_MS;
  const settled = settle(pet(), later);
  assert.equal(Math.round(settled.stock_g), 2400);
  assert.equal(stockStatus(settled, later + DAY_MS).stockG, stockStatus(pet(), later + DAY_MS).stockG);
});

test('a tela e a mensagem da loja mostram o mesmo número de dias (5,97 dias são "6" nos dois)', async () => {
  const { serializePet } = await import('../server/lib/pet-model.js');
  const { customerAlert, storeAlert, wholeDays } = await import('../server/services/messages.js');
  const pet = {
    id: 1, name: 'Thor', species: 'dog', breed_id: 'labrador', breed_name: 'Labrador', adult_kg: 30, color: 'Preto', birth_at: T0 - 800 * DAY_MS,
    weight_kg: null, neutered: 1, kcal_per_kg: null, meals_per_day: 2, meal_times: null, monthly_purchase_g: 9000, daily_mode: 'custom',
    daily_g: 300, stock_g: 1791, stock_at: T0, alert_days: 7,
  };
  const rawDays = 1791 / 300; // 5,97
  const screen = Math.floor(serializePet(pet, T0).stock.daysLeft); // o que o app mostra
  assert.equal(screen, 6);
  assert.equal(wholeDays(rawDays), screen);
  assert.match(customerAlert({ petName: 'Thor', storeName: 'Loja', kind: 'low', daysLeft: rawDays }).body, /Restam 6 dias/);
  assert.match(storeAlert({ customer: { name: 'Ana', whatsapp: '5511999998888' }, pet: { name: 'Thor', breedName: 'Labrador', color: 'Preto' }, kind: 'low', daysLeft: rawDays, suggestedKg: 9 }), /6 dias de ração/);
  // saco recém-comprado de conta exata não perde um dia por causa dos segundos que passaram
  assert.equal(Math.floor(serializePet({ ...pet, stock_g: 9000 }, T0 + 5000).stock.daysLeft), 30);
});
