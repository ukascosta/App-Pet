import crypto from 'node:crypto';
import { HttpError } from './lib/validate.js';

export const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

function bearer(req) {
  return /^Bearer (\S+)$/.exec(req.get('authorization') ?? '')?.[1];
}

/** Identifica o tutor pelo token enviado pelo app. */
export function customerAuth(db) {
  const find = db.prepare('SELECT c.* FROM sessions s JOIN customers c ON c.id = s.customer_id WHERE s.token_hash = ?');
  return (req, _res, next) => {
    const token = bearer(req);
    const customer = token ? find.get(sha256(token)) : undefined;
    if (!customer) return next(new HttpError(401, 'Sua sessão expirou. Entre novamente.'));
    req.customer = customer;
    req.tokenHash = sha256(token);
    next();
  };
}

/** Painel da loja: senha enviada no cabeçalho x-store-key. */
export function storeAuth(config) {
  const expected = sha256(config.store.adminPassword);
  return (req, _res, next) => {
    const given = sha256(req.get('x-store-key') ?? '');
    if (!crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
      return next(new HttpError(401, 'Senha da loja incorreta.'));
    }
    next();
  };
}

/** Limite simples por IP (janela fixa, em memória) contra abuso de cadastro/login. */
export function rateLimit({ windowMs, max, key = (req) => req.ip }) {
  const hits = new Map();
  return (req, _res, next) => {
    const now = Date.now();
    const id = key(req);
    const entry = hits.get(id);
    if (!entry || entry.resetAt <= now) {
      hits.set(id, { count: 1, resetAt: now + windowMs });
      // limpeza oportunista
      if (hits.size > 5000) for (const [k, e] of hits) if (e.resetAt <= now) hits.delete(k);
      return next();
    }
    if (++entry.count > max) return next(new HttpError(429, 'Muitas tentativas. Aguarde alguns minutos.'));
    next();
  };
}

export function securityHeaders(_req, res, next) {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self'",
      "style-src-attr 'unsafe-inline'",
      "img-src 'self' data:",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
  });
  next();
}

export function errorHandler(log) {
  // eslint-disable-next-line no-unused-vars
  return (err, _req, res, _next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, field: err.field });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Requisição inválida.' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Requisição grande demais.' });
    log.error(err);
    res.status(500).json({ error: 'Algo deu errado do nosso lado. Tente novamente.' });
  };
}
