import { Router } from 'express';
import { HttpError, rateLimit, setSessionCookie, clearSessionCookie } from '../http.js';

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role });

export function authRoutes({ auth, config, db }) {
  const r = Router();
  r.use(rateLimit({ windowMs: 10 * 60_000, max: 30 }));

  r.post('/request-code', async (req, res) => {
    const out = await auth.requestCode(req.body?.email);
    if (out.error) throw new HttpError(400, out.error);
    res.json({ ok: true, message: 'Se o e-mail estiver cadastrado em uma viagem Vagari, você receberá um código em instantes.' });
  });

  r.post('/verify-code', (req, res) => {
    const out = auth.verifyCode(req.body?.email, req.body?.code);
    if (out.error) throw new HttpError(400, out.error);
    setSessionCookie(res, out.token, config);
    res.json({ user: publicUser(out.user), token: out.token });
  });

  /** Mostra para quem é o convite antes de aceitar (não consome o convite). */
  r.get('/invite/:token', (req, res) => {
    const info = auth.inviteInfo(req.params.token);
    if (info.error) throw new HttpError(410, info.error, { code: info.code });
    res.json({ trip_name: info.row.trip_name, traveler_first_name: (info.row.user_name || '').split(' ')[0], expires_at: info.row.expires_at });
  });

  r.post('/invite/:token/accept', (req, res) => {
    const out = auth.acceptInvite(req.params.token);
    if (out.error) throw new HttpError(410, out.error, { code: out.code });
    setSessionCookie(res, out.token, config);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(out.userId);
    res.json({ user: publicUser(user), trip_id: out.tripId, token: out.token, needs_profile: !user.name });
  });

  r.post('/logout', (req, res) => {
    auth.logout(req.token);
    clearSessionCookie(res, config);
    res.json({ ok: true });
  });

  return r;
}
