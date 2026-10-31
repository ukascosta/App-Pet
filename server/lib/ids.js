import crypto from 'node:crypto';

/** Identificador interno aleatório (não sequencial, não previsível). */
export const newId = (prefix = '') => prefix + crypto.randomBytes(12).toString('base64url');

/** Segredo longo para links (convite, sessão). Guardamos só o hash. */
export const newToken = () => crypto.randomBytes(32).toString('base64url');

export const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

/** Código numérico de 6 dígitos para login por e-mail. */
export const newLoginCode = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');

export function hmac(secret, data) {
  return crypto.createHmac('sha256', secret).update(data).digest('base64url');
}

export function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}
