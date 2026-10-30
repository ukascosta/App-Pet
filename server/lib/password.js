// Senhas: hash scrypt (nativo do Node, sem dependência) com sal aleatório por senha.

import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);
const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 32;

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, KEYLEN, { N, r: R, p: P });
  return ['scrypt', N, R, P, salt.toString('base64'), key.toString('base64')].join('$');
}

// Usado quando o e-mail não existe, para o tempo de resposta não revelar quais e-mails estão cadastrados.
const DUMMY = await hashPassword('senha-que-nunca-sera-usada');

export async function verifyPassword(password, stored) {
  const [scheme, n, r, p, salt, key] = (stored || DUMMY).split('$');
  if (scheme !== 'scrypt') return false;
  const expected = Buffer.from(key, 'base64');
  const actual = await scrypt(password, Buffer.from(salt, 'base64'), expected.length, { N: Number(n), r: Number(r), p: Number(p) });
  return crypto.timingSafeEqual(actual, expected) && Boolean(stored);
}
