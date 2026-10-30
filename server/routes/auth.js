import { Router } from 'express';
import { hashPassword, verifyPassword, PASSWORD_MAX, PASSWORD_MIN } from '../lib/password.js';
import { normalizeWhatsApp } from '../lib/phone.js';
import { HttpError, email as validEmail, text } from '../lib/validate.js';
import { customerAuth, rateLimit } from '../middleware.js';
import { publicCustomer } from '../services/auth.js';

const MINUTE = 60_000;
const RESET_TTL = 60 * MINUTE;
const STATE_TTL = 10 * MINUTE;
const CODE_TTL = 2 * MINUTE;
const SOCIAL_COLUMN = { google: 'google_id', facebook: 'facebook_id' };

function password(value, field = 'password') {
  if (typeof value !== 'string' || value.length < PASSWORD_MIN) {
    throw new HttpError(400, `A senha precisa ter pelo menos ${PASSWORD_MIN} caracteres.`, field);
  }
  if (value.length > PASSWORD_MAX) throw new HttpError(400, 'A senha está muito longa.', field);
  return value;
}

function cookie(req, name) {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

export function authRoutes({ db, config, auth, oauth, alerts, now, log }) {
  const api = Router();
  const pages = Router();
  const requireLogin = customerAuth(db);

  const byEmail = db.prepare('SELECT * FROM customers WHERE email = ?');
  const byId = db.prepare('SELECT * FROM customers WHERE id = ?');
  const ipLimit = rateLimit({ windowMs: 10 * MINUTE, max: 30 });
  // Contra tentativa de adivinhar a senha de uma conta específica.
  const loginLimit = rateLimit({ windowMs: 15 * MINUTE, max: 10, key: (req) => `login:${String(req.body?.email ?? '').toLowerCase()}` });
  const resetLimit = rateLimit({ windowMs: 15 * MINUTE, max: 5, key: (req) => `reset:${String(req.body?.email ?? '').toLowerCase()}` });

  const session = (customer, status = 200, res) =>
    res.status(status).json({ token: auth.startSession(customer.id), customer: publicCustomer(customer) });

  // ---------- cadastro e login por senha ----------

  api.post('/customers', ipLimit, async (req, res) => {
    const b = req.body ?? {};
    const name = text(b.name, 'name', 'seu nome', { min: 2, max: 80 });
    const mail = validEmail(b.email);
    const whatsapp = normalizeWhatsApp(b.whatsapp);
    if (!whatsapp) throw new HttpError(400, 'Informe um WhatsApp válido com DDD, ex.: (11) 99999-8888.', 'whatsapp');
    const pass = password(b.password);
    if (b.consent !== true) throw new HttpError(400, 'Para avisar você e a loja, precisamos da sua autorização.', 'consent');

    const clash = db.prepare('SELECT email FROM customers WHERE email = ? OR whatsapp = ?').get(mail, whatsapp);
    if (clash) {
      const isEmail = clash.email === mail;
      throw new HttpError(409, `Já existe um cadastro com este ${isEmail ? 'e-mail' : 'WhatsApp'}. Toque em "Entrar" para acessar.`, isEmail ? 'email' : 'whatsapp');
    }

    const at = now();
    const { lastInsertRowid } = db
      .prepare('INSERT INTO customers (name, email, whatsapp, consent_at, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(name, mail, whatsapp, at, await hashPassword(pass), at);
    session(byId.get(lastInsertRowid), 201, res);
  });

  api.post('/session', ipLimit, loginLimit, async (req, res) => {
    const mail = validEmail(req.body?.email);
    const pass = typeof req.body?.password === 'string' ? req.body.password : '';
    const customer = byEmail.get(mail);
    // Sempre calcula o hash, existindo a conta ou não (o tempo de resposta não entrega quem está cadastrado).
    const ok = await verifyPassword(pass, customer?.password_hash);
    if (!customer || !ok) throw new HttpError(401, 'E-mail ou senha incorretos.', 'password');
    session(customer, 200, res);
  });

  api.delete('/session', requireLogin, (req, res) => {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(req.tokenHash);
    res.status(204).end();
  });

  // ---------- senha esquecida / trocar senha ----------

  api.post('/password/forgot', ipLimit, resetLimit, (req, res) => {
    const mail = validEmail(req.body?.email);
    const customer = byEmail.get(mail);
    if (customer) {
      const token = auth.issue('reset', { customerId: customer.id, ttlMs: RESET_TTL });
      const link = `${config.publicUrl}/#/senha/redefinir?token=${token}`;
      alerts.queueEmail(customer.id, {
        subject: 'Crie uma nova senha no PetLee',
        text: `Olá, ${customer.name.split(' ')[0]}!\n\nPara criar uma nova senha, abra este link (vale por 1 hora):\n${link}\n\nSe não foi você que pediu, ignore este e-mail: nada muda na sua conta.`,
      });
      if (!config.isProd) log.info(`[dev] link de redefinição de senha para ${mail}: ${link}`);
    }
    // Mesma resposta exista a conta ou não.
    res.status(204).end();
  });

  api.post('/password/reset', ipLimit, async (req, res) => {
    // Valida a senha antes de gastar o link: uma senha curta demais não pode obrigar a pedir outro e-mail.
    const pass = password(req.body?.password);
    const row = auth.consume('reset', req.body?.token);
    if (!row) throw new HttpError(400, 'Este link expirou ou já foi usado. Peça um novo.', 'token');
    db.prepare('UPDATE customers SET password_hash = ?, email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?').run(await hashPassword(pass), now(), row.customer_id);
    db.prepare('DELETE FROM sessions WHERE customer_id = ?').run(row.customer_id); // sai de todos os aparelhos
    session(byId.get(row.customer_id), 200, res);
  });

  api.put('/me/password', requireLogin, ipLimit, async (req, res) => {
    const me = byId.get(req.customer.id);
    if (me.password_hash && !(await verifyPassword(String(req.body?.currentPassword ?? ''), me.password_hash))) {
      throw new HttpError(400, 'A senha atual está incorreta.', 'currentPassword');
    }
    const next = password(req.body?.newPassword, 'newPassword');
    db.prepare('UPDATE customers SET password_hash = ? WHERE id = ?').run(await hashPassword(next), me.id);
    db.prepare('DELETE FROM sessions WHERE customer_id = ? AND token_hash <> ?').run(me.id, req.tokenHash);
    res.status(204).end();
  });

  // ---------- login com Google / Facebook ----------

  api.post('/oauth/exchange', ipLimit, (req, res) => {
    const row = auth.consume('oauth_code', req.body?.code);
    if (!row) throw new HttpError(400, 'O login expirou. Tente novamente.');
    session(byId.get(row.customer_id), 200, res);
  });

  const back = (res, error) => res.redirect(`/#/entrar?erro=${error}`);
  const secure = config.publicUrl.startsWith('https://');

  pages.get('/:provider', (req, res) => {
    const name = req.params.provider;
    if (!oauth.has(name)) return back(res, 'falha');
    if (!oauth.isEnabled(name)) return back(res, `indisponivel_${name}`);
    const state = auth.issue('oauth_state', { data: name, ttlMs: STATE_TTL });
    // O cookie amarra o retorno ao mesmo navegador que iniciou o login (evita "login CSRF").
    res.cookie('pl_oauth', state, { httpOnly: true, sameSite: 'lax', secure, path: '/auth', maxAge: STATE_TTL });
    res.redirect(oauth.authorizeUrl(name, state));
  });

  pages.get('/:provider/callback', async (req, res) => {
    const name = req.params.provider;
    if (!oauth.has(name) || !oauth.isEnabled(name)) return back(res, 'falha');
    res.clearCookie('pl_oauth', { path: '/auth' });

    const { code, state, error } = req.query;
    if (error) return back(res, 'cancelado');
    const stored = auth.consume('oauth_state', state);
    if (!stored || stored.data !== name || cookie(req, 'pl_oauth') !== state || typeof code !== 'string') {
      return back(res, 'sessao_expirada');
    }

    try {
      const profile = await oauth.profile(name, code);
      const column = SOCIAL_COLUMN[name];
      let customer = db.prepare(`SELECT * FROM customers WHERE ${column} = ?`).get(profile.id);

      if (!customer && profile.email) {
        const existing = byEmail.get(profile.email);
        // Só junta com uma conta existente se o provedor garante que o e-mail é do usuário.
        if (existing && !profile.emailVerified) return back(res, 'email_em_uso');
        if (existing) {
          // O cadastro por senha não confirma o e-mail. Se esta conta nunca provou ser do dono do e-mail, quem a criou
          // pode ser outra pessoa (que sabe a senha). Então a conta passa para quem acabou de provar o e-mail no Google/Facebook:
          // a senha, as sessões e o WhatsApp antigos são apagados (o pet e o histórico ficam).
          if (!existing.email_verified_at && existing.password_hash) {
            db.prepare('UPDATE customers SET password_hash = NULL, whatsapp = NULL, consent_at = NULL WHERE id = ?').run(existing.id);
            db.prepare('DELETE FROM sessions WHERE customer_id = ?').run(existing.id);
          }
          db.prepare(`UPDATE customers SET ${column} = ?, email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?`).run(profile.id, now(), existing.id);
          customer = byId.get(existing.id);
        }
      }
      if (!customer) {
        if (!profile.email) return back(res, 'sem_email');
        const { lastInsertRowid } = db
          .prepare(`INSERT INTO customers (name, email, ${column}, email_verified_at, created_at) VALUES (?, ?, ?, ?, ?)`)
          .run(String(profile.name ?? profile.email).slice(0, 80), profile.email, profile.id, profile.emailVerified ? now() : null, now());
        customer = byId.get(lastInsertRowid);
      }

      const exchange = auth.issue('oauth_code', { customerId: customer.id, ttlMs: CODE_TTL });
      res.redirect(`/#/oauth?code=${exchange}`);
    } catch (err) {
      log.error(`[oauth:${name}] ${err.message}`);
      back(res, 'falha');
    }
  });

  return { api, pages };
}
