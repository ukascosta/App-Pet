// Validação de entrada. Mensagens em português porque aparecem para o usuário.

export class HttpError extends Error {
  constructor(status, message, field) {
    super(message);
    this.status = status;
    this.field = field;
  }
}

const bad = (message, field) => new HttpError(400, message, field);

export function text(value, field, label, { min = 1, max = 80 } = {}) {
  const v = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (v.length < min) throw bad(`Informe ${label}.`, field);
  if (v.length > max) throw bad(`${label[0].toUpperCase()}${label.slice(1)} está muito longo.`, field);
  return v;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export function email(value, field = 'email') {
  const v = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!EMAIL.test(v) || v.length > 120) throw bad('Informe um e-mail válido.', field);
  return v;
}

export function number(value, field, label, { min, max, optional = false } = {}) {
  if (optional && (value === undefined || value === null || value === '')) return null;
  const n = typeof value === 'string' ? Number(value.replace(',', '.')) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) throw bad(`Informe ${label}.`, field);
  if (min !== undefined && n < min) throw bad(`${label[0].toUpperCase()}${label.slice(1)} deve ser de pelo menos ${min}.`, field);
  if (max !== undefined && n > max) throw bad(`${label[0].toUpperCase()}${label.slice(1)} deve ser de no máximo ${max}.`, field);
  return n;
}

export function oneOf(value, field, allowed, label) {
  if (!allowed.includes(value)) throw bad(`Escolha ${label}.`, field);
  return value;
}

export const bool = (value, fallback = false) => (value === undefined || value === null ? fallback : value === true || value === 'true' || value === 1);
