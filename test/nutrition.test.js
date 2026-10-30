import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BREEDS, breedsOf, findBreed } from '../server/data/breeds.js';
import { recommend, sizeOf, weightNote } from '../server/lib/nutrition.js';

const adult = (species, adultKg, extra = {}) => recommend({ species, adultKg, ageMonths: 36, ...extra });

test('cão adulto castrado de 10 kg: ~165 g/dia (RER 394 × 1,6 ÷ 3.800 kcal/kg)', () => {
  const r = adult('dog', 10, { weightKg: 10 });
  assert.equal(r.stage, 'adult');
  assert.equal(r.dailyKcal, 630);
  assert.equal(r.dailyGrams, 165);
  assert.equal(r.meals, 2);
});

test('cão adulto de 30 kg: ~380 g/dia; gato adulto de 4 kg: ~60 g/dia', () => {
  assert.equal(adult('dog', 30, { weightKg: 30 }).dailyGrams, 380);
  assert.equal(adult('cat', 4, { weightKg: 4 }).dailyGrams, 60);
});

test('animal inteiro come mais que castrado', () => {
  const neutered = adult('dog', 20, { weightKg: 20, neutered: true }).dailyGrams;
  const intact = adult('dog', 20, { weightKg: 20, neutered: false }).dailyGrams;
  assert.ok(intact > neutered);
});

test('kcal da embalagem muda a porção na proporção inversa', () => {
  const base = adult('dog', 10, { weightKg: 10, kcalPerKg: 3800 }).dailyGrams;
  const dense = adult('dog', 10, { weightKg: 10, kcalPerKg: 4300 }).dailyGrams;
  assert.ok(dense < base);
});

test('filhote: peso estimado, mais refeições e porção por kg maior que a do adulto', () => {
  const pup = recommend({ species: 'dog', adultKg: 30, ageMonths: 3 });
  assert.equal(pup.stage, 'puppy');
  assert.equal(pup.weightEstimated, true);
  assert.equal(pup.meals, 4);
  assert.ok(pup.weightKg < 30 / 2);
  const gramsPerKgPup = pup.dailyGrams / pup.weightKg;
  const gramsPerKgAdult = adult('dog', 30, { weightKg: 30 }).dailyGrams / 30;
  assert.ok(gramsPerKgPup > gramsPerKgAdult * 1.5);
});

test('porção do filhote só aumenta com a idade e chega perto da do adulto na maturidade', () => {
  const grams = (m) => recommend({ species: 'dog', adultKg: 30, ageMonths: m }).dailyGrams;
  const growing = [2, 3, 4, 5, 6, 7, 8, 9].map(grams);
  for (let i = 1; i < growing.length; i++) assert.ok(growing[i] >= growing[i - 1], `meses 2..9: ${growing}`);
  const full = adult('dog', 30).dailyGrams;
  assert.ok(Math.abs(grams(16) - full) / full < 0.1, `${grams(16)} vs ${full}`);
});

test('filhote de gato: porção razoável e sem salto aos 4 meses', () => {
  const grams = (m) => recommend({ species: 'cat', adultKg: 4, ageMonths: m }).dailyGrams;
  assert.ok(grams(3) >= 45 && grams(3) <= 75, String(grams(3)));
  assert.ok(Math.abs(grams(4) - grams(3)) <= 10);
});

test('sênior usa fator menor; gato filhote usa 4 refeições até 4 meses', () => {
  const senior = recommend({ species: 'dog', adultKg: 20, ageMonths: 12 * 10, weightKg: 20 });
  const mature = recommend({ species: 'dog', adultKg: 20, ageMonths: 12 * 4, weightKg: 20 });
  assert.equal(senior.stage, 'senior');
  assert.ok(senior.dailyGrams < mature.dailyGrams);
  assert.equal(recommend({ species: 'cat', adultKg: 4, ageMonths: 2 }).meals, 4);
});

test('porte pelo peso adulto', () => {
  assert.equal(sizeOf('dog', 3), 'small');
  assert.equal(sizeOf('dog', 20), 'medium');
  assert.equal(sizeOf('dog', 32), 'large');
  assert.equal(sizeOf('dog', 60), 'giant');
  assert.equal(sizeOf('cat', 4), 'cat');
});

test('aviso de peso fora da faixa só para adultos', () => {
  assert.equal(weightNote({ weightKg: 40, minKg: 25, maxKg: 34, stage: 'adult' }), 'above');
  assert.equal(weightNote({ weightKg: 20, minKg: 25, maxKg: 34, stage: 'adult' }), 'below');
  assert.equal(weightNote({ weightKg: 30, minKg: 25, maxKg: 34, stage: 'adult' }), null);
  assert.equal(weightNote({ weightKg: 40, minKg: 25, maxKg: 34, stage: 'puppy' }), null);
});

test('catálogo: ids únicos, pesos coerentes e raças básicas presentes', () => {
  const ids = BREEDS.map((b) => b.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const b of BREEDS.filter((x) => !x.other)) {
    assert.ok(b.minKg > 0 && b.maxKg >= b.minKg, b.id);
    assert.ok(b.maxKg <= (b.species === 'cat' ? 12 : 100), b.id);
  }
  assert.ok(breedsOf('dog').length >= 90);
  assert.ok(breedsOf('cat').length >= 25);
  for (const id of ['srd-medio', 'labrador', 'shih-tzu', 'pastor-alemao', 'gato-srd', 'persa', 'siames', 'outra-cao', 'outra-gato']) {
    assert.ok(findBreed(id), id);
  }
});

test('toda raça do catálogo gera uma sugestão razoável', () => {
  for (const b of BREEDS.filter((x) => !x.other)) {
    const r = adult(b.species, b.adultKg);
    const perKg = r.dailyGrams / b.adultKg;
    assert.ok(r.dailyGrams >= 10 && perKg > 8 && perKg < 60, `${b.id}: ${r.dailyGrams} g para ${b.adultKg} kg`);
  }
});
