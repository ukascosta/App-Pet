// Rotina de refeições: quantas vezes por dia e em quais horários.
//
// Diretrizes gerais de manejo alimentar (AAHA/WSAVA): filhotes comem várias vezes ao dia;
// raças muito pequenas precisam de refeições menores e mais frequentes (risco de hipoglicemia);
// raças de peito profundo devem dividir a porção (risco de torção gástrica); gatos fazem
// várias refeições pequenas por natureza. É uma sugestão: a rotina real é da família.

const TIMES = {
  1: ['08:00'],
  2: ['07:30', '18:30'],
  3: ['07:00', '13:00', '19:00'],
  4: ['07:00', '11:30', '16:00', '20:00'],
  5: ['07:00', '10:30', '14:00', '17:30', '21:00'],
  6: ['06:30', '09:30', '12:30', '15:30', '18:30', '21:30'],
};

export const MAX_MEALS = 6;
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export const defaultTimes = (meals) => [...TIMES[Math.min(Math.max(Math.round(meals), 1), MAX_MEALS)]];

/**
 * @returns {{meals:number, times:string[], tips:string[]}}
 */
export function suggestFeeding({ species, size, stage, ageMonths, adultKg, deepChested = false }) {
  const tips = [];
  let meals;

  if (species === 'cat') {
    meals = ageMonths < 4 ? 4 : 3;
    tips.push(
      stage === 'puppy'
        ? 'Gatinhos têm o estômago pequeno e precisam comer várias vezes ao dia.'
        : 'Gatos preferem comer pouco e várias vezes ao dia, como fariam caçando. Divida a porção em refeições pequenas.',
    );
  } else if (stage === 'puppy') {
    meals = ageMonths < 4 ? 4 : ageMonths < 6 ? 3 : size === 'small' ? 3 : 2;
    tips.push('Filhotes têm o estômago pequeno e precisam comer várias vezes ao dia. A quantidade de refeições diminui conforme ele cresce.');
  } else {
    const toy = adultKg <= 4;
    meals = toy ? 3 : 2;
    if (toy) {
      tips.push('Raças muito pequenas podem ter queda de açúcar no sangue se ficarem muito tempo sem comer. Dividir a porção em 3 refeições ajuda.');
    }
  }

  if (deepChested) {
    meals = Math.max(meals, 2);
    tips.push('Raças de peito profundo têm risco de torção gástrica. Nunca dê a porção toda de uma vez e evite exercício intenso 1 hora antes e depois de comer.');
  }

  tips.push('Horários fixos ajudam a digestão e a rotina do pet. Ajuste para a sua rotina, mas mantenha sempre os mesmos horários.');
  return { meals, times: defaultTimes(meals), tips };
}
