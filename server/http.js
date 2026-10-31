import multer from 'multer';

export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    Object.assign(this, extra);
  }
}

export const SESSION_COOKIE = 'vg_session';

export function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function setSessionCookie(res, token, config) {
  const maxAge = config.sessionDays * 86_400;
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${config.isProd ? '; Secure' : ''}`,
  );
}

export function clearSessionCookie(res, config) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${config.isProd ? '; Secure' : ''}`);
}

export function tokenFrom(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return parseCookies(req.headers.cookie)[SESSION_COOKIE] || null;
}

/** Carrega req.user a partir do cookie de sessão (ou Bearer, para testes/integrações). */
export function authenticate(auth) {
  return (req, _res, next) => {
    req.token = tokenFrom(req);
    req.user = auth.userFromToken(req.token);
    next();
  };
}

export function requireUser(req, _res, next) {
  if (!req.user) throw new HttpError(401, 'Entre para continuar.');
  next();
}

export const requireRole =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user) throw new HttpError(401, 'Entre para continuar.');
    if (!roles.includes(req.user.role)) throw new HttpError(403, 'Você não tem permissão para esta ação.');
    next();
  };

export const requireAdmin = requireRole('admin');
export const requireStaff = requireRole('admin', 'editor');

/** Bloqueia requisições de outros sites que tentem usar o cookie (defesa extra ao SameSite=Lax). */
export function originCheck(config) {
  const allowed = new URL(config.publicUrl).origin;
  return (req, _res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const origin = req.headers.origin;
    if (origin && origin !== allowed && origin !== `${req.protocol}://${req.headers.host}`) {
      throw new HttpError(403, 'Origem não permitida.');
    }
    next();
  };
}

/** Limitador simples em memória (por IP + rota). Suficiente para uma instância única. */
export function rateLimit({ windowMs, max }) {
  const hits = new Map();
  return (req, _res, next) => {
    const key = `${req.ip}|${req.baseUrl}${req.path}`;
    const t = Date.now();
    const arr = (hits.get(key) || []).filter((x) => t - x < windowMs);
    arr.push(t);
    hits.set(key, arr);
    if (hits.size > 10_000) hits.clear();
    if (arr.length > max) throw new HttpError(429, 'Muitas tentativas. Aguarde alguns minutos.');
    next();
  };
}

export function uploader(config) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: 60, fields: 40 },
  });
}

/** Nome do arquivo enviado (multer entrega latin1). */
export const uploadedName = (f) => Buffer.from(f.originalname, 'latin1').toString('utf8').split(/[\\/]/).pop();

export function securityHeaders(_req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
}

export function sendFile(res, { buffer, stream, fileName, mime, inline = true }) {
  res.setHeader('Content-Type', mime || 'application/octet-stream');
  res.setHeader('Cache-Control', 'private, no-store');
  const safe = String(fileName || 'arquivo').replace(/["\r\n]/g, '');
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(safe)}`);
  if (buffer) return res.end(buffer);
  stream.pipe(res);
}
