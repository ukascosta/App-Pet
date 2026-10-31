import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seededApp, startTestApp } from './helpers.js';

test('login por código: e-mail desconhecido não recebe nada e a resposta é a mesma', async () => {
  const { t } = await seededApp();
  try {
    const before = t.emails.length;
    const r = await t.call('POST', '/api/auth/request-code', { body: { email: 'ninguem@example.com' } });
    assert.equal(r.status, 200);
    assert.equal(t.emails.length, before);
    const r2 = await t.call('POST', '/api/auth/request-code', { body: { email: 'ana@example.com' } });
    assert.equal(r2.body.message, r.body.message);
    assert.equal(t.emails.length, before + 1);
  } finally {
    await t.close();
  }
});

test('código errado, limite de tentativas e expiração', async () => {
  const { t } = await seededApp();
  try {
    await t.call('POST', '/api/auth/request-code', { body: { email: 'ana@example.com' } });
    const code = t.emails.at(-1).subject.match(/(\d{6})/)[1];
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) assert.equal((await t.call('POST', '/api/auth/verify-code', { body: { email: 'ana@example.com', code: wrong } })).status, 400);
    // Esgotou as tentativas: nem o código certo funciona.
    assert.equal((await t.call('POST', '/api/auth/verify-code', { body: { email: 'ana@example.com', code } })).status, 400);

    await t.call('POST', '/api/auth/request-code', { body: { email: 'ana@example.com' } });
    const code2 = t.emails.at(-1).subject.match(/(\d{6})/)[1];
    t.clock.t += 11 * 60_000;
    assert.equal((await t.call('POST', '/api/auth/verify-code', { body: { email: 'ana@example.com', code: code2 } })).status, 400);
  } finally {
    await t.close();
  }
});

test('login com código cria sessão por cookie httpOnly', async () => {
  const { t } = await seededApp();
  try {
    await t.call('POST', '/api/auth/request-code', { body: { email: 'ANA@example.com ' } });
    const code = t.emails.at(-1).subject.match(/(\d{6})/)[1];
    const v = await t.call('POST', '/api/auth/verify-code', { body: { email: 'ana@example.com', code } });
    assert.equal(v.status, 200);
    const cookie = v.headers.get('set-cookie');
    assert.match(cookie, /vg_session=.+HttpOnly; SameSite=Lax/);
    const me = await t.call('GET', '/api/me', { headers: { Cookie: cookie.split(';')[0] } });
    assert.equal(me.body.user.email, 'ana@example.com');
    // Código é de uso único.
    assert.equal((await t.call('POST', '/api/auth/verify-code', { body: { email: 'ana@example.com', code } })).status, 400);
  } finally {
    await t.close();
  }
});

test('primeiro acesso do administrador vem de ADMIN_EMAILS', async () => {
  const t = await startTestApp();
  try {
    const token = await t.login('admin@vagari.test');
    const me = await t.call('GET', '/api/admin/me', { token });
    assert.equal(me.body.user.role, 'admin');
  } finally {
    await t.close();
  }
});

test('convite: só para viagem publicada, uso único, novo convite invalida o anterior, expira', async () => {
  const { t, admin } = await seededApp();
  try {
    const tt = t.db.prepare("SELECT tt.id FROM trip_travelers tt JOIN users u ON u.id = tt.user_id WHERE u.email = 'ana@example.com'").get();
    const inv1 = await t.call('POST', `/api/admin/trips/VG-001/travelers/${tt.id}/invite`, { token: admin, body: {} });
    assert.equal(inv1.status, 200);
    assert.ok(inv1.body.emailed);
    assert.match(t.emails.at(-1).text, /convite\//);
    const token1 = inv1.body.invite_url.split('/convite/')[1];
    const inv2 = await t.call('POST', `/api/admin/trips/VG-001/travelers/${tt.id}/invite`, { token: admin, body: { send_email: false } });
    const token2 = inv2.body.invite_url.split('/convite/')[1];
    assert.equal((await t.call('GET', `/api/auth/invite/${token1}`)).body.code, 'revoked');

    const info = await t.call('GET', `/api/auth/invite/${token2}`);
    assert.equal(info.body.trip_name, 'Itália em família');
    assert.equal(info.body.traveler_first_name, 'Ana');

    const acc = await t.call('POST', `/api/auth/invite/${token2}/accept`);
    assert.equal(acc.status, 200);
    assert.equal(acc.body.trip_id, 'VG-001');
    assert.equal((await t.call('GET', '/api/trips/VG-001', { token: acc.body.token })).status, 200);
    assert.equal(t.db.prepare('SELECT invitation_status FROM trip_travelers WHERE id = ?').get(tt.id).invitation_status, 'accepted');
    assert.equal((await t.call('POST', `/api/auth/invite/${token2}/accept`)).body.code, 'used');

    const inv3 = await t.call('POST', `/api/admin/trips/VG-001/travelers/${tt.id}/invite`, { token: admin, body: { send_email: false } });
    t.clock.advanceDays(15);
    const expired = await t.call('POST', `/api/auth/invite/${inv3.body.invite_url.split('/convite/')[1]}/accept`);
    assert.equal(expired.body.code, 'expired');

    // Viagem em rascunho: não convida.
    await t.call('PATCH', '/api/admin/trips/VG-001', { token: admin, body: { status: 'draft' } });
    assert.equal((await t.call('POST', `/api/admin/trips/VG-001/travelers/${tt.id}/invite`, { token: admin, body: {} })).status, 409);
  } finally {
    await t.close();
  }
});

test('associação: admin adiciona viajante pelo painel e remove; a viagem some para ele', async () => {
  const { t, admin } = await seededApp();
  try {
    const add = await t.call('POST', '/api/admin/trips/VG-001/travelers', { token: admin, body: { traveler_email: 'Duda@Example.com', traveler_name: 'Duda', role: 'acompanhante' } });
    assert.equal(add.status, 201, JSON.stringify(add.body));
    assert.equal(add.body.traveler.email, 'duda@example.com');
    // Repetir o mesmo e-mail na mesma viagem não duplica.
    const dup = await t.call('POST', '/api/admin/trips/VG-001/travelers', { token: admin, body: { traveler_email: 'duda@example.com', traveler_name: 'Duda' } });
    assert.equal(dup.status, 422);
    const duda = await t.login('duda@example.com');
    assert.equal((await t.call('GET', '/api/trips/VG-001', { token: duda })).status, 200);
    await t.call('DELETE', `/api/admin/trips/VG-001/travelers/${add.body.traveler.id}`, { token: admin });
    assert.equal((await t.call('GET', '/api/trips/VG-001', { token: duda })).status, 404);
    assert.deepEqual((await t.call('GET', '/api/me', { token: duda })).body.trips, []);
    const log = t.db.prepare("SELECT action FROM audit_log WHERE entity_type = 'trip_traveler' AND entity_id = ? ORDER BY created_at, rowid").all(add.body.traveler.id);
    assert.deepEqual(log.map((x) => x.action), ['create', 'delete']);
  } finally {
    await t.close();
  }
});

test('viajante ajusta só nome, telefone e preferências opcionais', async () => {
  const { t } = await seededApp();
  try {
    const ana = await t.login('ana@example.com');
    const r = await t.call('PATCH', '/api/me', {
      token: ana,
      body: { name: 'Ana S.', preferences: { interests: ['gastronomia', 'inventado'], restrictions: 'Vegetariana', avatar: 'face-7' }, notification_prefs: { email_reminders: false }, role: 'admin' },
    });
    assert.equal(r.status, 200);
    const me = await t.call('GET', '/api/me', { token: ana });
    assert.equal(me.body.user.name, 'Ana S.');
    assert.equal(me.body.user.role, 'traveler');
    assert.deepEqual(me.body.user.preferences.interests, ['gastronomia']);
    assert.equal(me.body.user.preferences.avatar, 'face-7');
    await t.call('PATCH', '/api/me', { token: ana, body: { preferences: { avatar: '<script>' } } });
    assert.equal((await t.call('GET', '/api/me', { token: ana })).body.user.preferences.avatar, '');
    assert.equal(me.body.notification_prefs.email_reminders, false);
  } finally {
    await t.close();
  }
});
