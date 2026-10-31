/**
 * Normalização de valores vindos de planilhas (XLSX/CSV) e de formulários do painel.
 * Cada parser devolve { value } ou { error, hint } — a mensagem vai direto para o relatório de erros.
 */
import { isTimeZone } from './time.js';

/** Remove acentos, deixa minúsculo e troca qualquer separador por "_". */
export function normKey(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Valor de célula do exceljs → primitivo, Date ou {text, hyperlink}. */
export function cellToRaw(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map((r) => r.text).join('');
    if ('formula' in v || 'sharedFormula' in v) return cellToRaw(v.result);
    if ('error' in v) return '';
    if ('hyperlink' in v) return { text: cellToRaw(v.text), hyperlink: v.hyperlink };
    if ('text' in v) return cellToRaw(v.text);
    return '';
  }
  return v;
}

export function asText(raw) {
  if (raw === null || raw === undefined) return '';
  if (raw instanceof Date) return raw.toISOString();
  if (typeof raw === 'object') return asText(raw.text || raw.hyperlink);
  return String(raw).replace(/ /g, ' ').trim();
}

export const isBlank = (raw) => asText(raw) === '';

const pad = (n) => String(n).padStart(2, '0');

function validYmd(y, m, d) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d && y >= 1900 && y <= 2200;
}

// Datas do Excel chegam como Date em UTC (exceljs). Números = serial do Excel.
function excelSerialToDate(n) {
  return new Date(Math.round((n - 25569) * 86_400_000));
}

const DATE_HINT = 'Use AAAA-MM-DD (ex.: 2026-12-20) ou DD/MM/AAAA (ex.: 20/12/2026).';
const TIME_HINT = 'Use HH:MM no formato 24h (ex.: 09:30 ou 21:15).';
const DATETIME_HINT = 'Use AAAA-MM-DD HH:MM ou DD/MM/AAAA HH:MM, no horário local do lugar (ex.: 20/12/2026 22:40).';

export function parseDate(raw) {
  if (raw instanceof Date) return { value: raw.toISOString().slice(0, 10) };
  if (typeof raw === 'number' && raw > 20000 && raw < 80000) return parseDate(excelSerialToDate(raw));
  const s = asText(raw);
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  let y, mo, d;
  if (m) [y, mo, d] = [+m[1], +m[2], +m[3]];
  else if ((m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/))) [d, mo, y] = [+m[1], +m[2], +m[3]];
  else return { error: `Data inválida: "${s}".`, hint: DATE_HINT };
  if (!validYmd(y, mo, d)) return { error: `Data inexistente: "${s}".`, hint: DATE_HINT };
  return { value: `${y}-${pad(mo)}-${pad(d)}` };
}

export function parseTime(raw) {
  if (raw instanceof Date) return { value: `${pad(raw.getUTCHours())}:${pad(raw.getUTCMinutes())}` };
  if (typeof raw === 'number' && raw >= 0 && raw < 1) {
    const mins = Math.round(raw * 1440);
    return { value: `${pad(Math.floor(mins / 60) % 24)}:${pad(mins % 60)}` };
  }
  const s = asText(raw).toLowerCase();
  const m = s.match(/^(\d{1,2})\s*[:h]\s*(\d{2})?(?::\d{2})?\s*(min)?$/);
  if (!m) return { error: `Horário inválido: "${asText(raw)}".`, hint: TIME_HINT };
  const h = +m[1];
  const mi = m[2] ? +m[2] : 0;
  if (h > 23 || mi > 59) return { error: `Horário inválido: "${asText(raw)}".`, hint: TIME_HINT };
  return { value: `${pad(h)}:${pad(mi)}` };
}

/** Data e hora local (sem fuso): "YYYY-MM-DDTHH:MM". allowDateOnly aceita só a data. */
export function parseDateTime(raw, { allowDateOnly = false } = {}) {
  if (raw instanceof Date) {
    const date = raw.toISOString().slice(0, 10);
    const time = `${pad(raw.getUTCHours())}:${pad(raw.getUTCMinutes())}`;
    return { value: time === '00:00' && allowDateOnly ? date : `${date}T${time}` };
  }
  if (typeof raw === 'number' && raw > 20000 && raw < 80000) return parseDateTime(excelSerialToDate(raw), { allowDateOnly });
  const s = asText(raw).replace(/\s+/g, ' ');
  const m = s.match(/^(.+?)[ T](\d{1,2}\s*[:h]\s*\d{2}(?::\d{2})?)$/);
  if (!m) {
    if (allowDateOnly) {
      const d = parseDate(s);
      if (!d.error) return d;
    }
    return { error: `Data e hora inválidas: "${s}".`, hint: DATETIME_HINT };
  }
  const d = parseDate(m[1]);
  const t = parseTime(m[2]);
  if (d.error || t.error) return { error: `Data e hora inválidas: "${s}".`, hint: DATETIME_HINT };
  return { value: `${d.value}T${t.value}` };
}

export function parseEmail(raw) {
  const s = asText(raw).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) || s.length > 254)
    return { error: `E-mail inválido: "${asText(raw)}".`, hint: 'Confira se há espaços, falta de "@" ou de domínio (ex.: nome@empresa.com).' };
  return { value: s };
}

export function parseUrl(raw) {
  const s = raw && typeof raw === 'object' && !(raw instanceof Date) ? asText(raw.hyperlink || raw.text) : asText(raw);
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error();
    return { value: u.toString() };
  } catch {
    return { error: `Link inválido: "${s}".`, hint: 'Use o endereço completo começando com https:// (ex.: https://www.exemplo.com).' };
  }
}

export function parseInteger(raw, { min = -Infinity, max = Infinity } = {}) {
  const s = asText(raw);
  const n = Number(s);
  if (!/^-?\d+(\.0+)?$/.test(s) || n < min || n > max) {
    const range = min > -Infinity && max < Infinity ? ` entre ${min} e ${max}` : min > -Infinity ? ` a partir de ${min}` : '';
    return { error: `Número inteiro inválido: "${s}".`, hint: `Use um número inteiro${range}, sem letras.` };
  }
  return { value: Math.trunc(n) };
}

export function parseDecimal(raw, { min = -Infinity, max = Infinity } = {}) {
  if (typeof raw === 'number') {
    if (raw < min || raw > max) return { error: `Número fora da faixa (${min} a ${max}): ${raw}.`, hint: 'Confira o valor.' };
    return { value: raw };
  }
  const s = asText(raw).replace(',', '.');
  const n = Number(s);
  if (!/^-?\d+(\.\d+)?$/.test(s) || n < min || n > max)
    return { error: `Número inválido: "${asText(raw)}".`, hint: `Use um número entre ${min} e ${max} (ex.: 41.9028 ou 41,9028).` };
  return { value: n };
}

const TRUE = new Set(['sim', 's', 'yes', 'y', 'true', 'verdadeiro', '1', 'x', 'visivel']);
const FALSE = new Set(['nao', 'n', 'no', 'false', 'falso', '0', 'oculto', 'interno']);
export function parseBool(raw) {
  if (typeof raw === 'boolean') return { value: raw };
  const k = normKey(raw);
  if (TRUE.has(k)) return { value: true };
  if (FALSE.has(k)) return { value: false };
  return { error: `Valor inválido: "${asText(raw)}".`, hint: 'Use "sim" ou "não".' };
}

export function parseTimeZone(raw) {
  const s = asText(raw);
  if (!isTimeZone(s))
    return { error: `Fuso horário inválido: "${s}".`, hint: 'Use o nome IANA do fuso (ex.: Europe/Rome, America/Sao_Paulo, Asia/Tokyo).' };
  return { value: s };
}

/** Telefone: guarda só dígitos (com DDI quando houver). */
export function parsePhone(raw) {
  const digits = asText(raw).replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15)
    return { error: `Telefone inválido: "${asText(raw)}".`, hint: 'Informe com DDD (e DDI se for de fora do Brasil), ex.: +55 11 99999-0000.' };
  return { value: digits };
}

/** Identificador estável: sem espaços, até 60 caracteres. */
export function parseStableId(raw) {
  const s = asText(raw);
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,59}$/.test(s))
    return {
      error: `Identificador inválido: "${s}".`,
      hint: 'Use só letras, números, hífen, ponto ou sublinhado, sem espaços nem acentos (ex.: VG-2026-001, roma, roma-coliseu).',
    };
  return { value: s };
}

/** Escolha em uma lista configurável (aceita a chave, o rótulo ou um apelido, sem acento/maiúscula). */
export function parseEnum(raw, options) {
  const k = normKey(raw);
  for (const o of options) {
    const names = [o.key, o.label, ...(o.aliases || [])].map(normKey);
    if (names.includes(k)) return { value: o.key };
  }
  return {
    error: `Opção inválida: "${asText(raw)}".`,
    hint: `Use uma destas: ${options.map((o) => o.key).join(', ')}.`,
  };
}

export function parseTags(raw) {
  const tags = asText(raw)
    .split(/[,;|]/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  return { value: [...new Set(tags)].slice(0, 30) };
}
