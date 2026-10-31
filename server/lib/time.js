/** Utilidades de data respeitando o fuso horário da viagem. Datas "puras" são strings YYYY-MM-DD. */

const DAY = 86_400_000;

/** Data de hoje (YYYY-MM-DD) no fuso informado. */
export function todayIn(timeZone, now = Date.now()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timeZone || 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(now));
}

/** Diferença em dias entre duas datas YYYY-MM-DD (b - a). */
export function daysBetween(a, b) {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / DAY);
}

export function addDays(date, n) {
  return new Date(Date.parse(date + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10);
}

export function isTimeZone(tz) {
  if (!tz || typeof tz !== 'string') return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz === 'UTC' || tz.includes('/');
  } catch {
    return false;
  }
}

export const nowIso = (now = Date.now()) => new Date(now).toISOString();
