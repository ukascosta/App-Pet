import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { BREEDS, findBreed } from '../server/data/breeds.js';
import { defaultTimes, suggestFeeding } from '../server/lib/feeding.js';
import { recommend } from '../server/lib/nutrition.js';
import { startTestApp, validCustomer, validPet } from './helpers.js';

const suggest = (breedId, ageMonths, species = 'dog') => {
  const b = findBreed(breedId);
  const r = recommend({ species, adultKg: b.adultKg, ageMonths, deepChested: b.deepChested });
  return r.schedule;
};

test('filhote de cão: 4 refeições até 4 meses, 3 até 6, depois 2 (raça pequena segue com 3)', () => {
  assert.equal(suggest('labrador', 3).meals, 4);
  assert.equal(suggest('labrador', 5).meals, 3);
  assert.equal(suggest('labrador', 8).meals, 2);
  assert.equal(suggest('shih-tzu', 8).meals, 3);
});

test('adultos: cão 2 refeições, raça toy 3, gato 3', () => {
  assert.equal(suggest('labrador', 48).meals, 2);
  assert.equal(suggest('pug', 48).meals, 2);
  assert.equal(suggest('chihuahua', 48).meals, 3);
  assert.equal(suggest('yorkshire', 48).meals, 3);
  assert.equal(suggest('siames', 48, 'cat').meals, 3);
  assert.equal(suggest('persa', 2, 'cat').meals, 4);
});

test('raças de peito profundo ganham o alerta de torção gástrica; as demais não', () => {
  assert.ok(suggest('dogue-alemao', 48).tips.some((t) => /torção gástrica/.test(t)));
  assert.ok(suggest('pastor-alemao', 48).tips.some((t) => /torção gástrica/.test(t)));
  assert.ok(!suggest('shih-tzu', 48).tips.some((t) => /torção gástrica/.test(t)));
  assert.ok(suggest('chihuahua', 48).tips.some((t) => /queda de açúcar/.test(t)));
});

test('os horários sugeridos são válidos, ordenados e do tamanho certo', () => {
  for (let n = 1; n <= 6; n++) {
    const times = defaultTimes(n);
    assert.equal(times.length, n);
    assert.deepEqual([...times].sort(), times);
    assert.ok(times.every((t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)));
  }
});

test('toda raça do catálogo recebe uma rotina entre 2 e 4 refeições com horários', () => {
  for (const b of BREEDS.filter((x) => !x.other)) {
    for (const months of [2, 5, 9, 36, 140]) {
      const s = suggestFeeding({ species: b.species, size: b.size, stage: months < 12 ? 'puppy' : 'adult', ageMonths: months, adultKg: b.adultKg, deepChested: b.deepChested });
      assert.ok(s.meals >= 2 && s.meals <= 4, `${b.id} ${months}m: ${s.meals}`);
      assert.equal(s.times.length, s.meals);
      assert.ok(s.tips.length >= 1);
    }
  }
});

test('a porção por refeição acompanha a quantidade de refeições', () => {
  const r = recommend({ species: 'dog', adultKg: 30, ageMonths: 36, weightKg: 30 });
  assert.equal(r.meals, 2);
  assert.equal(r.mealGrams, r.dailyGrams / 2);
});

describe('refeições do pet na API', () => {
  let t, token;
  before(async () => {
    t = await startTestApp();
    token = (await t.call('POST', '/api/customers', { body: validCustomer() })).body.token;
  });
  after(() => t.close());

  test('sem informar, usa a sugestão da raça', async () => {
    const { pet } = (await t.call('POST', '/api/pets', { token, body: validPet() })).body;
    assert.equal(pet.mealsPerDay, 2);
    assert.deepEqual(pet.mealTimes, ['07:30', '18:30']);
    assert.equal(pet.mealGrams, 190);
    assert.deepEqual(pet.recommendation.schedule.times, ['07:30', '18:30']);
  });

  test('tutor escolhe quantidade e horários (guardados em ordem)', async () => {
    const res = await t.call('POST', '/api/pets', { token, body: validPet({ name: 'Rex', mealsPerDay: 3, mealTimes: ['19:30', '07:00', '12:30'] }) });
    assert.equal(res.status, 201);
    assert.deepEqual(res.body.pet.mealTimes, ['07:00', '12:30', '19:30']);
    assert.equal(res.body.pet.mealGrams, 125);
  });

  test('só quantidade: usa os horários padrão dela', async () => {
    const { pet } = (await t.call('POST', '/api/pets', { token, body: validPet({ name: 'Bob', mealsPerDay: 4 }) })).body;
    assert.deepEqual(pet.mealTimes, defaultTimes(4));
  });

  test('recusa horário inválido, repetido, ou quantidade diferente da lista', async () => {
    for (const bad of [
      { mealsPerDay: 2, mealTimes: ['25:00', '18:00'] },
      { mealsPerDay: 2, mealTimes: ['07:00', '07:00'] },
      { mealsPerDay: 3, mealTimes: ['07:00', '18:00'] },
      { mealsPerDay: 7 },
      { mealsPerDay: 0 },
    ]) {
      const res = await t.call('POST', '/api/pets', { token, body: validPet(bad) });
      assert.equal(res.status, 400, JSON.stringify(bad));
    }
  });

  test('editar a rotina', async () => {
    const id = (await t.call('GET', '/api/me', { token })).body.pets[0].id;
    const res = await t.call('PATCH', `/api/pets/${id}`, { token, body: { ...validPet(), ageYears: 3, mealsPerDay: 1, mealTimes: ['09:00'] } });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.pet.mealTimes, ['09:00']);
    assert.equal(res.body.pet.mealGrams, 380);
  });
});
