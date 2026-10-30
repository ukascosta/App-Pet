// Conversões entre a linha do banco e o que a API devolve.

import { findBreed } from '../data/breeds.js';
import { DAYS_PER_MONTH, ageInMonths, recommend, weightNote } from './nutrition.js';
import { stockStatus } from './stock.js';

export function recommendationFor(pet, at) {
  const ageMonths = ageInMonths(pet.birth_at, at);
  const result = recommend({
    species: pet.species,
    adultKg: pet.adult_kg,
    ageMonths,
    weightKg: pet.weight_kg ?? undefined,
    neutered: !!pet.neutered,
    kcalPerKg: pet.kcal_per_kg ?? undefined,
  });
  const breed = findBreed(pet.breed_id);
  return {
    ...result,
    weightNote: weightNote({ weightKg: pet.weight_kg, minKg: breed?.minKg, maxKg: breed?.maxKg, stage: result.stage }),
  };
}

/** Consumo diário (g) conforme a opção escolhida pelo tutor. */
export function resolveDailyGrams({ mode, customGrams, monthlyPurchaseGrams, recommendedGrams }) {
  if (mode === 'purchase') return monthlyPurchaseGrams / DAYS_PER_MONTH;
  if (mode === 'custom') return customGrams;
  return recommendedGrams;
}

const kg = (grams) => Math.round(grams / 10) / 100; // 2 casas
const oneDecimal = (n) => Math.round(n * 10) / 10;

export function serializePet(pet, at) {
  const status = stockStatus(pet, at);
  return {
    id: pet.id,
    name: pet.name,
    species: pet.species,
    breedId: pet.breed_id,
    breedName: pet.breed_name,
    adultKg: pet.adult_kg,
    color: pet.color,
    ageMonths: Math.floor(ageInMonths(pet.birth_at, at)),
    weightKg: pet.weight_kg,
    neutered: !!pet.neutered,
    kcalPerKg: pet.kcal_per_kg,
    monthlyPurchaseKg: kg(pet.monthly_purchase_g),
    dailyMode: pet.daily_mode,
    dailyGrams: Math.round(pet.daily_g),
    alertDays: pet.alert_days,
    stock: {
      kg: kg(status.stockG),
      daysLeft: oneDecimal(status.daysLeft),
      runsOutAt: new Date(status.runsOutAt).toISOString(),
      level: status.level,
      percent: Math.round(status.percent * 100) / 100,
    },
    recommendation: recommendationFor(pet, at),
  };
}
