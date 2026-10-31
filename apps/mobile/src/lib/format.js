/** Datas em pt-BR sem depender de Intl (funciona igual no iOS, Android e web). */
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MONTHS_FULL = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const WEEK = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const WEEK_FULL = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

const parts = (date) => {
  const [y, m, d] = String(date).slice(0, 10).split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { y, m, d, wd };
};

export const dayMonth = (date) => {
  const { m, d } = parts(date);
  return `${d} ${MONTHS[m - 1]}`;
};
export const weekdayShort = (date) => WEEK[parts(date).wd];
export const longDate = (date) => {
  const { m, d, wd } = parts(date);
  return `${WEEK_FULL[wd]}, ${d} de ${MONTHS_FULL[m - 1]}`;
};
export const range = (a, b) => {
  const pa = parts(a);
  const pb = parts(b);
  if (pa.m === pb.m && pa.y === pb.y) return `${pa.d} a ${pb.d} de ${MONTHS[pb.m - 1]}`;
  return `${pa.d} ${MONTHS[pa.m - 1]} a ${pb.d} ${MONTHS[pb.m - 1]}`;
};
export const time = (dt) => (dt && dt.length >= 16 ? dt.slice(11, 16) : dt && /^\d\d:\d\d/.test(dt) ? dt.slice(0, 5) : null);
export const fileSize = (b) => (b > 1_000_000 ? `${(b / 1_000_000).toFixed(1).replace('.', ',')} MB` : `${Math.round(b / 1000)} KB`);
export const firstName = (n) => (n || '').trim().split(/\s+/)[0] || '';
export const ago = (isoTs, now = Date.now()) => {
  const min = Math.round((now - Date.parse(isoTs)) / 60000);
  if (min < 60) return `${Math.max(min, 1)} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h`;
  return `${Math.round(h / 24)} d`;
};
export const dueText = (task) => {
  if (task.done) return 'Feito ✓';
  if (task.days_left === null || task.days_left === undefined) return 'Faz agora';
  if (task.days_left < 0) return 'Atrasada';
  if (task.days_left === 0) return 'Vence hoje';
  if (task.days_left === 1) return 'Vence amanhã';
  return `Até ${dayMonth(task.due_date)}`;
};
