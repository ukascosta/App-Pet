// Template HTML que escapa tudo por padrão (evita XSS com nome do pet, etc.).

class Safe {
  constructor(value) {
    this.value = value;
  }
  toString() {
    return this.value;
  }
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escape = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

function part(v) {
  if (v instanceof Safe) return v.value;
  if (Array.isArray(v)) return v.map(part).join('');
  if (v === null || v === undefined || v === false) return '';
  return escape(v);
}

export function html(strings, ...values) {
  let out = strings[0];
  values.forEach((v, i) => (out += part(v) + strings[i + 1]));
  return new Safe(out);
}

export const raw = (s) => new Safe(s);

// ---------- formatação (pt-BR) ----------

const nf = (max) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: max });
export const fmtNumber = (n, max = 1) => nf(max).format(n);
export const fmtKg = (kg) => `${fmtNumber(kg, 2)} kg`;
export const fmtGrams = (g) => `${fmtNumber(g, 0)} g`;

export function fmtAge(months) {
  const y = Math.floor(months / 12);
  const m = months % 12;
  const years = y ? `${y} ${y === 1 ? 'ano' : 'anos'}` : '';
  const mon = m ? `${m} ${m === 1 ? 'mês' : 'meses'}` : '';
  return [years, mon].filter(Boolean).join(' e ') || 'recém-nascido';
}

export function fmtDays(days) {
  if (days <= 0) return 'acabou';
  if (days < 1) return 'menos de 1 dia';
  const n = Math.floor(days);
  return `${n} ${n === 1 ? 'dia' : 'dias'}`;
}

export const fmtDate = (iso) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');

export function fmtWhen(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ontem' : `há ${d} dias`;
}

// (11) 99999-8888 enquanto digita
export function maskPhone(value) {
  const d = value.replace(/\D/g, '').replace(/^55(?=\d{11})/, '').slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : '';
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export const normalizeText = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const debounce = (fn, ms) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
};

// ---------- refeições ----------

/** Próxima refeição a partir de uma lista de horários "HH:MM" (considera o dia seguinte). */
export function nextMeal(times, now = new Date()) {
  const current = now.getHours() * 60 + now.getMinutes();
  let best = null;
  times.forEach((time, index) => {
    const [h, m] = time.split(':').map(Number);
    let diff = h * 60 + m - current;
    if (diff < 0) diff += 24 * 60;
    if (!best || diff < best.inMin) best = { time, index, inMin: diff };
  });
  return best;
}

export function fmtIn(min) {
  if (min < 1) return 'agora';
  if (min < 60) return `em ${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `em ${h} h ${m} min` : `em ${h} h`;
}

/** Nota de 0 a 4 para a força da senha (só orienta; o servidor exige apenas o tamanho mínimo). */
export function passwordStrength(pw) {
  if (!pw) return 0;
  let score = pw.length >= 8 ? 1 : 0;
  if (pw.length >= 12) score++;
  if (/[a-z]/i.test(pw) && /\d/.test(pw)) score++;
  if (/[A-Z]/.test(pw) && /[^\w\s]/.test(pw)) score++;
  return Math.min(score, 4) || 1;
}
