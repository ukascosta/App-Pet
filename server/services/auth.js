// Sessões e códigos de uso único (redefinição de senha, login social).

import crypto from 'node:crypto';
import { sha256 } from '../middleware.js';

export function createAuthService({ db, now }) {
  const randomToken = () => crypto.randomBytes(32).toString('base64url');

  return {
    startSession(customerId) {
      const token = randomToken();
      db.prepare('INSERT INTO sessions (token_hash, customer_id, created_at) VALUES (?, ?, ?)').run(sha256(token), customerId, now());
      return token;
    },

    /** Cria um código de uso único. Só o hash fica no banco. */
    issue(kind, { customerId = null, data = null, ttlMs }) {
      const token = randomToken();
      db.prepare('DELETE FROM auth_tokens WHERE expires_at < ?').run(now());
      db.prepare('INSERT INTO auth_tokens (token_hash, kind, customer_id, data, expires_at) VALUES (?, ?, ?, ?, ?)').run(
        sha256(token),
        kind,
        customerId,
        data,
        now() + ttlMs,
      );
      return token;
    },

    /** Consome (apaga) o código se existir, for do tipo certo e não tiver expirado. */
    consume(kind, token) {
      if (typeof token !== 'string' || !token) return null;
      const hash = sha256(token);
      const row = db.prepare('SELECT * FROM auth_tokens WHERE token_hash = ? AND kind = ?').get(hash, kind);
      if (!row) return null;
      db.prepare('DELETE FROM auth_tokens WHERE token_hash = ?').run(hash);
      return row.expires_at >= now() ? row : null;
    },
  };
}

export const publicCustomer = (c) => ({
  id: c.id,
  name: c.name,
  email: c.email,
  whatsapp: c.whatsapp,
  // Quem entrou com Google/Facebook ainda precisa informar o WhatsApp e aceitar o contato da loja.
  profileComplete: Boolean(c.whatsapp && c.consent_at),
  hasPassword: Boolean(c.password_hash),
  providers: [c.google_id && 'google', c.facebook_id && 'facebook'].filter(Boolean),
});
