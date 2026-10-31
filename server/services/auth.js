/**
 * Acesso sem senha (PRD §4.1): link de convite ou código de 6 dígitos por e-mail.
 * Não há autocadastro: o viajante precisa ter sido associado a uma viagem pela Vagari.
 * Guardamos só hashes de códigos, convites e sessões.
 */
import { newId, newToken, newLoginCode, sha256, safeEqual } from '../lib/ids.js';
import { nowIso } from '../lib/time.js';
import { audit } from '../lib/audit.js';

const MAX_CODES_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;

export function createAuth({ db, config, mailer, settings, log = console, now = () => Date.now() }) {
  const codeHash = (email, code) => sha256(`${config.secret}:${email.toLowerCase()}:${code}`);
  const iso = (ms) => new Date(ms).toISOString();

  function ensureBootstrapAdmin(email) {
    if (!config.adminEmails.includes(email)) return;
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    const ts = nowIso(now());
    if (!user) {
      const id = newId('usr_');
      db.prepare(`INSERT INTO users (id, email, name, role, created_at, updated_at) VALUES (?, ?, '', 'admin', ?, ?)`).run(id, email, ts, ts);
      audit(db, { actorId: null, entityType: 'user', entityId: id, action: 'bootstrap_admin', after: { email, role: 'admin' }, source: 'system' });
    } else if (user.role !== 'admin') {
      db.prepare(`UPDATE users SET role = 'admin', updated_at = ? WHERE id = ?`).run(ts, user.id);
      audit(db, { actorId: null, entityType: 'user', entityId: user.id, action: 'bootstrap_admin', before: { role: user.role }, after: { role: 'admin' }, source: 'system' });
    }
  }

  function createSession(userId) {
    const token = newToken();
    const t = now();
    db.prepare('INSERT INTO sessions (id, token_hash, user_id, created_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      newId('ses_'),
      sha256(token),
      userId,
      iso(t),
      iso(t + config.sessionDays * 86_400_000),
      iso(t),
    );
    db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(iso(t), userId);
    return token;
  }

  return {
    createSession,

    /** Sempre responde igual, exista ou não o e-mail (não revela quem é cliente). */
    async requestCode(emailRaw) {
      const email = String(emailRaw || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { error: 'Informe um e-mail válido.' };
      ensureBootstrapAdmin(email);
      const user = db.prepare('SELECT * FROM users WHERE email = ? AND disabled_at IS NULL').get(email);
      if (!user) return { ok: true };
      const recent = db
        .prepare('SELECT COUNT(*) n FROM login_codes WHERE email = ? AND created_at > ?')
        .get(email, iso(now() - 3_600_000)).n;
      if (recent >= MAX_CODES_PER_HOUR) return { ok: true, throttled: true };
      const code = newLoginCode();
      db.prepare('INSERT INTO login_codes (id, email, code_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)').run(
        newId('lc_'),
        email,
        codeHash(email, code),
        iso(now()),
        iso(now() + config.loginCodeMinutes * 60_000),
      );
      const agency = settings.get('agency_name');
      await mailer.send({
        to: email,
        subject: `${agency}: seu código de acesso é ${code}`,
        text: `Olá${user.name ? `, ${user.name}` : ''}!\n\nSeu código de acesso: ${code}\nEle vale por ${config.loginCodeMinutes} minutos.\n\nSe não foi você, ignore este e-mail.`,
      });
      return { ok: true };
    },

    verifyCode(emailRaw, codeRaw) {
      const email = String(emailRaw || '').trim().toLowerCase();
      const code = String(codeRaw || '').replace(/\D/g, '');
      const row = db
        .prepare('SELECT * FROM login_codes WHERE email = ? AND used_at IS NULL AND expires_at > ? ORDER BY created_at DESC LIMIT 1')
        .get(email, iso(now()));
      if (!row || row.attempts >= MAX_ATTEMPTS) return { error: 'Código inválido ou expirado. Peça um novo.' };
      db.prepare('UPDATE login_codes SET attempts = attempts + 1 WHERE id = ?').run(row.id);
      if (!safeEqual(row.code_hash, codeHash(email, code))) return { error: 'Código incorreto.' };
      db.prepare('UPDATE login_codes SET used_at = ? WHERE id = ?').run(iso(now()), row.id);
      const user = db.prepare('SELECT * FROM users WHERE email = ? AND disabled_at IS NULL').get(email);
      if (!user) return { error: 'Código inválido ou expirado. Peça um novo.' };
      return { token: createSession(user.id), user };
    },

    userFromToken(token) {
      if (!token) return null;
      const row = db
        .prepare(
          `SELECT u.*, s.id session_id, s.last_seen_at FROM sessions s JOIN users u ON u.id = s.user_id
           WHERE s.token_hash = ? AND s.expires_at > ? AND u.disabled_at IS NULL`,
        )
        .get(sha256(token), iso(now()));
      if (!row) return null;
      if (!row.last_seen_at || now() - Date.parse(row.last_seen_at) > 3_600_000)
        db.prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ?').run(iso(now()), row.session_id);
      return row;
    },

    logout(token) {
      if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
    },

    /** Gera um convite novo (invalida os anteriores não usados) e devolve o link. */
    createInvite(tripTravelerId, actorId) {
      const days = settings.get('invite_expiry_days');
      const token = newToken();
      const t = now();
      db.transaction(() => {
        db.prepare('UPDATE invites SET revoked_at = ? WHERE trip_traveler_id = ? AND used_at IS NULL AND revoked_at IS NULL').run(iso(t), tripTravelerId);
        db.prepare('INSERT INTO invites (id, trip_traveler_id, token_hash, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)').run(
          newId('inv_'),
          tripTravelerId,
          sha256(token),
          actorId,
          iso(t),
          iso(t + days * 86_400_000),
        );
        db.prepare(
          `UPDATE trip_travelers SET invitation_status = CASE WHEN invitation_status = 'accepted' THEN 'accepted' ELSE 'sent' END, updated_at = ? WHERE id = ?`,
        ).run(iso(t), tripTravelerId);
      })();
      return { token, url: `${config.publicUrl}/convite/${token}`, expiresAt: iso(t + days * 86_400_000) };
    },

    inviteInfo(token) {
      const row = db
        .prepare(
          `SELECT i.*, tt.trip_id, tt.user_id, tr.name trip_name, tr.status trip_status, u.name user_name, u.email
           FROM invites i JOIN trip_travelers tt ON tt.id = i.trip_traveler_id
           JOIN trips tr ON tr.id = tt.trip_id JOIN users u ON u.id = tt.user_id
           WHERE i.token_hash = ?`,
        )
        .get(sha256(String(token || '')));
      if (!row) return { error: 'Convite inválido.', code: 'invalid' };
      if (row.revoked_at) return { error: 'Este convite foi substituído por um mais recente.', code: 'revoked' };
      if (row.used_at) return { error: 'Este convite já foi usado. Entre com seu e-mail para receber um código.', code: 'used' };
      if (row.expires_at <= iso(now())) return { error: 'Este convite expirou. Peça um novo à Vagari ou entre com seu e-mail.', code: 'expired' };
      if (row.trip_status !== 'published') return { error: 'Esta viagem ainda não está disponível. Fale com a Vagari.', code: 'unavailable' };
      return { row };
    },

    /** Convite de uso único: ao aceitar, cria a sessão e marca o viajante como ativo. */
    acceptInvite(token) {
      const info = this.inviteInfo(token);
      if (info.error) return info;
      const { row } = info;
      const ts = iso(now());
      db.transaction(() => {
        db.prepare('UPDATE invites SET used_at = ? WHERE id = ?').run(ts, row.id);
        db.prepare("UPDATE trip_travelers SET invitation_status = 'accepted', updated_at = ? WHERE id = ?").run(ts, row.trip_traveler_id);
      })();
      return { token: createSession(row.user_id), userId: row.user_id, tripId: row.trip_id };
    },
  };
}
