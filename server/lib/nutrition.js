// Sugestão de porção diária de ração seca.
//
// Método (nutrição clínica veterinária – NRC 2006, AAHA 2021, WSAVA):
//   RER (kcal/dia)  = 70 × peso_kg^0,75            energia em repouso
//   DER (kcal/dia)  = RER × fator da fase de vida   energia diária
//   gramas/dia      = DER ÷ kcal por kg da ração × 1000
//
// É uma referência, não uma prescrição: a embalagem e o veterinário do pet
// sempre têm a palavra final (a interface avisa isso).

export const DAY_MS = 86_400_000;
export const DAYS_PER_MONTH = 30;
const MONTH_MS = DAY_MS * 30.4375;

// Densidade energética típica de ração seca super premium (kcal de EM por kg).
export const DEFAULT_KCAL_PER_KG = { dog: 3800, cat: 4000 };

// Porte do cão pelo peso adulto – mesma divisão usada nas embalagens.
export function sizeOf(species, adultKg) {
  if (species === 'cat') return 'cat';
  if (adultKg <= 10) return 'small';
  if (adultKg <= 25) return 'medium';
  if (adultKg <= 45) return 'large';
  return 'giant';
}

// Idade (em meses) em que o pet termina de crescer.
const MATURITY_MONTHS = { cat: 12, small: 11, medium: 13, large: 16, giant: 22 };
// Idade (em anos) a partir da qual é considerado sênior.
const SENIOR_YEARS = { cat: 11, small: 9, medium: 8, large: 7, giant: 6 };

// Fator de energia do adulto.
const ADULT_FACTOR = {
  dog: { neutered: 1.6, intact: 1.8, senior: 1.4 },
  cat: { neutered: 1.2, intact: 1.4, senior: 1.2 },
};
// Fator de energia aos 2 meses; desce de forma linear até o fator adulto na maturidade.
// Raças grandes/gigantes partem de um valor menor: crescer devagar protege as articulações (WSAVA).
const YOUNG_FACTOR_START = { cat: 2.5, small: 3.0, medium: 3.0, large: 2.6, giant: 2.6 };

export function ageInMonths(birthAt, now) {
  return Math.max(0, (now - birthAt) / MONTH_MS);
}

export function lifeStage(species, size, ageMonths) {
  if (ageMonths < MATURITY_MONTHS[size]) return 'puppy';
  if (ageMonths >= SENIOR_YEARS[size] * 12) return 'senior';
  return 'adult';
}

// Peso estimado de um filhote quando o tutor não informa o peso.
export function estimateWeight(size, adultKg, ageMonths) {
  const maturity = MATURITY_MONTHS[size];
  if (ageMonths >= maturity) return adultKg;
  const fraction = 0.1 + 0.9 * Math.pow(Math.max(ageMonths, 0.5) / maturity, 0.8);
  return adultKg * Math.min(fraction, 1);
}

function energyFactor(species, size, stage, ageMonths, neutered) {
  const adult = ADULT_FACTOR[species];
  if (stage === 'senior') return adult.senior;
  const adultFactor = neutered ? adult.neutered : adult.intact;
  if (stage === 'adult') return adultFactor;

  const start = YOUNG_FACTOR_START[species === 'cat' ? 'cat' : size];
  const maturity = MATURITY_MONTHS[size];
  const progress = Math.min(1, Math.max(0, (ageMonths - 2) / (maturity - 2)));
  return start + (adultFactor - start) * progress;
}

function mealsPerDay(ageMonths) {
  if (ageMonths < 4) return 4;
  if (ageMonths < 6) return 3;
  return 2;
}

const roundTo = (value, step) => Math.round(value / step) * step;

/**
 * @param {object} p
 * @param {'dog'|'cat'} p.species
 * @param {number} p.adultKg      peso adulto típico da raça (ou informado pelo tutor)
 * @param {number} p.ageMonths
 * @param {number} [p.weightKg]   peso atual, se o tutor souber
 * @param {boolean} [p.neutered]
 * @param {number} [p.kcalPerKg]  energia da ração (rótulo da embalagem)
 */
export function recommend({ species, adultKg, ageMonths, weightKg, neutered = true, kcalPerKg }) {
  const size = sizeOf(species, adultKg);
  const stage = lifeStage(species, size, ageMonths);
  const weightEstimated = !(weightKg > 0);
  const weight = weightEstimated ? estimateWeight(size, adultKg, ageMonths) : weightKg;
  const kcal = kcalPerKg > 0 ? kcalPerKg : DEFAULT_KCAL_PER_KG[species];

  const rer = 70 * Math.pow(weight, 0.75);
  const factor = energyFactor(species, size, stage, ageMonths, neutered);
  const der = rer * factor;

  const dailyGrams = Math.max(10, roundTo((der / kcal) * 1000, 5));
  const meals = mealsPerDay(ageMonths);

  return {
    species,
    size,
    stage,
    weightKg: Math.round(weight * 10) / 10,
    weightEstimated,
    kcalPerKg: kcal,
    dailyKcal: Math.round(der),
    dailyGrams,
    meals,
    mealGrams: roundTo(dailyGrams / meals, 5),
    monthlyKg: Math.round(((dailyGrams * DAYS_PER_MONTH) / 1000) * 10) / 10,
  };
}

/**
 * Compara o peso informado com a faixa típica da raça (adultos).
 * Serve só para um aviso gentil: "converse com o veterinário".
 */
export function weightNote({ weightKg, minKg, maxKg, stage }) {
  if (!(weightKg > 0) || stage === 'puppy' || !(minKg > 0)) return null;
  if (weightKg > maxKg * 1.15) return 'above';
  if (weightKg < minKg * 0.85) return 'below';
  return null;
}
