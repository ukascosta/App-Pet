import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { startTestApp, validCustomer, validPet } from './helpers.js';

const SOCIAL_ENV = {
  GOOGLE_CLIENT_ID: 'gid', GOOGLE_CLIENT_SECRET: 'gsecret',
  FACEBOOK_APP_ID: 'fid', FACEBOOK_APP_SECRET: 'fsecret',
};

describe('senha', () => {
  let t;
  before(async () => { t = await startTestApp(); });
  after(() => t.close());

  test('exige senha com 8+ caracteres e não guarda a senha em texto', async () => {
    const short = await t.call('POST', '/api/customers', { body: validCustomer({ password: '1234567' }) });
    assert.equal(short.status, 400);
    assert.equal(short.body.field, 'password');
    const ok = await t.call('POST', '/api/customers', { body: validCustomer() });
    assert.equal(ok.status, 201);
    assert.equal(ok.body.customer.hasPassword, true);
    assert.equal(ok.body.customer.profileComplete, true);
    const stored = t.db.prepare('SELECT password_hash FROM customers').get().password_hash;
    assert.match(stored, /^scrypt\$/);
    assert.ok(!stored.includes('senha-segura-1'));
  });

  test('erro de login é igual para e-mail inexistente e senha errada', async () => {
    const wrongPass = await t.call('POST', '/api/session', { body: { email: 'maria@example.com', password: 'errada-123' } });
    const noUser = await t.call('POST', '/api/session', { body: { email: 'ninguem@example.com', password: 'errada-123' } });
    assert.equal(wrongPass.status, 401);
    assert.equal(noUser.status, 401);
    assert.equal(wrongPass.body.error, noUser.body.error);
  });

  test('bloqueia após muitas tentativas para o mesmo e-mail', async () => {
    const t2 = await startTestApp();
    try {
      await t2.call('POST', '/api/customers', { body: validCustomer() });
      let last;
      for (let i = 0; i < 12; i++) last = await t2.call('POST', '/api/session', { body: { email: 'maria@example.com', password: `tentativa-${i}-x` } });
      assert.equal(last.status, 429);
      // nem a senha certa passa enquanto estiver bloqueado
      assert.equal((await t2.call('POST', '/api/session', { body: { email: 'maria@example.com', password: 'senha-segura-1' } })).status, 429);
    } finally {
      await t2.close();
    }
  });

  test('esqueci a senha: e-mail com link de uso único, nova senha e sessões antigas encerradas', async () => {
    const old = (await t.call('POST', '/api/session', { body: { email: 'maria@example.com', password: 'senha-segura-1' } })).body.token;

    // mesma resposta exista a conta ou não
    assert.equal((await t.call('POST', '/api/password/forgot', { body: { email: 'ninguem@example.com' } })).status, 204);
    assert.equal(t.sentEmails.length, 0);
    assert.equal((await t.call('POST', '/api/password/forgot', { body: { email: 'maria@example.com' } })).status, 204);
    await t.alerts.flushOutbox();
    assert.equal(t.sentEmails.length, 1);
    const link = /https:\/\/app\.petlee\.test\/#\/senha\/redefinir\?token=([\w-]+)/.exec(t.sentEmails[0].text);
    assert.ok(link, t.sentEmails[0].text);

    // senha curta demais não gasta o link
    const weak = await t.call('POST', '/api/password/reset', { body: { token: link[1], password: '123' } });
    assert.equal(weak.status, 400);
    assert.equal(weak.body.field, 'password');
    const done = await t.call('POST', '/api/password/reset', { body: { token: link[1], password: 'nova-senha-123' } });
    assert.equal(done.status, 200);
    // e o link é de uso único
    assert.equal((await t.call('POST', '/api/password/reset', { body: { token: link[1], password: 'outra-senha-999' } })).status, 400);
    assert.equal((await t.call('GET', '/api/me', { token: done.body.token })).status, 200);
    assert.equal((await t.call('GET', '/api/me', { token: old })).status, 401, 'sessão antiga deve cair');
    assert.equal((await t.call('POST', '/api/session', { body: { email: 'maria@example.com', password: 'senha-segura-1' } })).status, 401);
    assert.equal((await t.call('POST', '/api/session', { body: { email: 'maria@example.com', password: 'nova-senha-123' } })).status, 200);
  });

  test('link de redefinição expira em 1 hora', async () => {
    await t.call('POST', '/api/password/forgot', { body: { email: 'maria@example.com' } });
    await t.alerts.flushOutbox();
    const token = /token=([\w-]+)/.exec(t.sentEmails.at(-1).text)[1];
    t.clock.advanceDays(1 / 24 + 0.01);
    assert.equal((await t.call('POST', '/api/password/reset', { body: { token, password: 'qualquer-senha-9' } })).status, 400);
  });

  test('trocar senha exige a atual e mantém só o aparelho de quem trocou', async () => {
    const a = (await t.call('POST', '/api/session', { body: { email: 'maria@example.com', password: 'nova-senha-123' } })).body.token;
    const b = (await t.call('POST', '/api/session', { body: { email: 'maria@example.com', password: 'nova-senha-123' } })).body.token;
    assert.equal((await t.call('PUT', '/api/me/password', { token: a, body: { currentPassword: 'errada', newPassword: 'outra-senha-456' } })).status, 400);
    assert.equal((await t.call('PUT', '/api/me/password', { token: a, body: { currentPassword: 'nova-senha-123', newPassword: 'outra-senha-456' } })).status, 204);
    assert.equal((await t.call('GET', '/api/me', { token: a })).status, 200);
    assert.equal((await t.call('GET', '/api/me', { token: b })).status, 401);
  });
});

describe('login com Google e Facebook', () => {
  let t, calls, profile;
  const fakeFetch = async (url, init = {}) => {
    const u = String(url);
    calls.push(u);
    const ok = (body) => ({ ok: true, status: 200, json: async () => body });
    if (u.includes('oauth2.googleapis.com/token')) {
      assert.equal(new URLSearchParams(init.body).get('client_secret'), 'gsecret');
      return ok({ access_token: 'g-token' });
    }
    if (u.includes('openidconnect.googleapis.com')) return ok(profile.google);
    if (u.includes('graph.facebook.com/v21.0/oauth/access_token')) return ok({ access_token: 'f-token' });
    if (u.includes('graph.facebook.com/v21.0/me')) return ok(profile.facebook);
    throw new Error(`fetch inesperado: ${u}`);
  };

  before(async () => {
    t = await startTestApp(SOCIAL_ENV, { fetchFn: fakeFetch });
  });
  after(() => t.close());

  /** Faz o fluxo inteiro e devolve onde o servidor mandou o navegador no final. */
  async function loginWith(provider, { tamperState = false, dropCookie = false } = {}) {
    const start = await t.call('GET', `/auth/${provider}`, { raw: true });
    assert.equal(start.status, 302);
    const authorize = new URL(start.headers.get('location'));
    const state = authorize.searchParams.get('state');
    const setCookie = start.headers.get('set-cookie');
    assert.match(setCookie, /pl_oauth=/);
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=Lax/i);
    assert.equal(authorize.searchParams.get('redirect_uri'), `https://app.petlee.test/auth/${provider}/callback`);

    const cb = await t.call('GET', `/auth/${provider}/callback?code=abc&state=${tamperState ? 'falso' : state}`, {
      raw: true,
      headers: dropCookie ? {} : { Cookie: setCookie.split(';')[0] },
    });
    return { authorize, location: cb.headers.get('location') };
  }

  test('a configuração informa quais provedores estão ligados', async () => {
    const cfg = (await t.call('GET', '/api/config')).body;
    assert.equal(cfg.auth.google, true);
    assert.equal(cfg.auth.facebook, true);
  });

  test('Google: cria a conta sem senha e sem WhatsApp, e o código troca por sessão (uma vez só)', async () => {
    calls = [];
    profile = { google: { sub: 'g-1', email: 'Ana@Example.com', email_verified: true, name: 'Ana Souza' } };
    const { authorize, location } = await loginWith('google');
    assert.equal(authorize.host, 'accounts.google.com');
    assert.match(authorize.searchParams.get('scope'), /email/);
    const code = new URL(location, 'https://x').hash.match(/oauth\?code=([\w-]+)/)?.[1];
    assert.ok(code, location);

    const ex = await t.call('POST', '/api/oauth/exchange', { body: { code } });
    assert.equal(ex.status, 200);
    assert.equal(ex.body.customer.email, 'ana@example.com');
    assert.equal(ex.body.customer.hasPassword, false);
    assert.equal(ex.body.customer.profileComplete, false);
    assert.deepEqual(ex.body.customer.providers, ['google']);
    assert.equal((await t.call('POST', '/api/oauth/exchange', { body: { code } })).status, 400, 'código de uso único');
    t.anaToken = ex.body.token;
  });

  test('sem WhatsApp e aceite não pode cadastrar pet; ao completar, pode', async () => {
    const blocked = await t.call('POST', '/api/pets', { token: t.anaToken, body: validPet() });
    assert.equal(blocked.status, 403);
    assert.equal((await t.call('PATCH', '/api/me', { token: t.anaToken, body: { name: 'Ana Souza', whatsapp: '(21) 98888-7777' } })).body.field, 'consent');
    const done = await t.call('PATCH', '/api/me', { token: t.anaToken, body: { name: 'Ana Souza', whatsapp: '(21) 98888-7777', consent: true } });
    assert.equal(done.body.customer.profileComplete, true);
    assert.equal((await t.call('POST', '/api/pets', { token: t.anaToken, body: validPet() })).status, 201);
  });

  test('segundo login com o mesmo Google entra na mesma conta', async () => {
    const { location } = await loginWith('google');
    const code = /oauth\?code=([\w-]+)/.exec(location)[1];
    const ex = await t.call('POST', '/api/oauth/exchange', { body: { code } });
    assert.equal(ex.body.customer.profileComplete, true);
    assert.equal(t.db.prepare("SELECT COUNT(*) n FROM customers WHERE email = 'ana@example.com'").get().n, 1);
  });

  test('e-mail já cadastrado com senha: junta a conta só se o provedor confirma o e-mail', async () => {
    await t.call('POST', '/api/customers', { body: validCustomer({ email: 'bia@example.com', whatsapp: '31977776666' }) });

    profile = { google: { sub: 'g-bia', email: 'bia@example.com', email_verified: false, name: 'Bia' } };
    assert.match((await loginWith('google')).location, /erro=email_em_uso/);

    profile = { google: { sub: 'g-bia', email: 'bia@example.com', email_verified: true, name: 'Bia' } };
    const { location } = await loginWith('google');
    const ex = await t.call('POST', '/api/oauth/exchange', { body: { code: /code=([\w-]+)/.exec(location)[1] } });
    assert.deepEqual(ex.body.customer.providers, ['google']);
    // o e-mail da conta por senha nunca foi comprovado: a senha antiga é descartada (ver teste de pre-hijacking abaixo)
    assert.equal(ex.body.customer.hasPassword, false);
    assert.equal(t.db.prepare("SELECT COUNT(*) n FROM customers WHERE email = 'bia@example.com'").get().n, 1);
  });

  test('pre-hijacking: conta criada por senha sem provar o e-mail perde a senha, as sessões e o WhatsApp quando o dono entra pelo Google', async () => {
    // atacante cadastra o e-mail da vítima com a senha e o WhatsApp dele
    const evil = await t.call('POST', '/api/customers', { body: validCustomer({ name: 'Atacante', email: 'vitima@example.com', whatsapp: '(11) 90000-1111', password: 'senha-do-atacante-1' }) });
    assert.equal(evil.status, 201);
    const attackerToken = evil.body.token;

    // a vítima, dona do e-mail, entra pelo Google (e-mail confirmado pelo Google)
    profile = { google: { sub: 'g-vitima', email: 'vitima@example.com', email_verified: true, name: 'Vítima' } };
    const { location } = await loginWith('google');
    const ex = await t.call('POST', '/api/oauth/exchange', { body: { code: /code=([\w-]+)/.exec(location)[1] } });
    assert.equal(ex.body.customer.hasPassword, false, 'a senha do atacante foi apagada');
    assert.equal(ex.body.customer.profileComplete, false, 'WhatsApp e aceite do atacante foram apagados');
    assert.equal(ex.body.customer.whatsapp, null);

    assert.equal((await t.call('POST', '/api/session', { body: { email: 'vitima@example.com', password: 'senha-do-atacante-1' } })).status, 401);
    assert.equal((await t.call('GET', '/api/me', { token: attackerToken })).status, 401, 'sessão do atacante caiu');
    assert.equal((await t.call('GET', '/api/me', { token: ex.body.token })).status, 200);
  });

  test('conta cujo e-mail já foi comprovado (redefiniu a senha) mantém a senha ao entrar pelo Google', async () => {
    const reg = await t.call('POST', '/api/customers', { body: validCustomer({ name: 'Dora', email: 'dora@example.com', whatsapp: '(41) 98888-1212', password: 'senha-da-dora-1' }) });
    assert.equal(reg.status, 201);
    await t.call('POST', '/api/password/forgot', { body: { email: 'dora@example.com' } });
    await t.alerts.flushOutbox();
    const link = /token=([\w-]+)/.exec(t.sentEmails.at(-1).text)[1];
    assert.equal((await t.call('POST', '/api/password/reset', { body: { token: link, password: 'senha-da-dora-2' } })).status, 200);

    profile = { google: { sub: 'g-dora', email: 'dora@example.com', email_verified: true, name: 'Dora' } };
    const { location } = await loginWith('google');
    const ex = await t.call('POST', '/api/oauth/exchange', { body: { code: /code=([\w-]+)/.exec(location)[1] } });
    assert.equal(ex.body.customer.hasPassword, true);
    assert.equal(ex.body.customer.profileComplete, true);
    assert.equal((await t.call('POST', '/api/session', { body: { email: 'dora@example.com', password: 'senha-da-dora-2' } })).status, 200);
  });

  test('Facebook funciona igual e sem e-mail não cria conta', async () => {
    profile = { facebook: { id: 'f-1', name: 'Caio Lima', email: 'caio@example.com' } };
    const ok = await loginWith('facebook');
    assert.equal(ok.authorize.host, 'www.facebook.com');
    const ex = await t.call('POST', '/api/oauth/exchange', { body: { code: /code=([\w-]+)/.exec(ok.location)[1] } });
    assert.deepEqual(ex.body.customer.providers, ['facebook']);

    profile = { facebook: { id: 'f-2', name: 'Sem Email' } };
    assert.match((await loginWith('facebook')).location, /erro=sem_email/);
  });

  test('proteção contra login forjado: state falso ou sem o cookie do mesmo navegador', async () => {
    profile = { google: { sub: 'g-evil', email: 'evil@example.com', email_verified: true, name: 'Evil' } };
    assert.match((await loginWith('google', { tamperState: true })).location, /erro=sessao_expirada/);
    assert.match((await loginWith('google', { dropCookie: true })).location, /erro=sessao_expirada/);
    assert.equal(t.db.prepare("SELECT COUNT(*) n FROM customers WHERE email = 'evil@example.com'").get().n, 0);
  });

  test('usuário que cancela no provedor volta com aviso', async () => {
    const res = await t.call('GET', '/auth/google/callback?error=access_denied', { raw: true });
    assert.match(res.headers.get('location'), /erro=cancelado/);
  });

  test('falha do provedor não derruba o servidor', async () => {
    const t2 = await startTestApp(SOCIAL_ENV, { fetchFn: async () => { throw new Error('rede caiu'); } });
    try {
      const start = await t2.call('GET', '/auth/google', { raw: true });
      const state = new URL(start.headers.get('location')).searchParams.get('state');
      const cb = await t2.call('GET', `/auth/google/callback?code=x&state=${state}`, { raw: true, headers: { Cookie: start.headers.get('set-cookie').split(';')[0] } });
      assert.match(cb.headers.get('location'), /erro=falha/);
    } finally {
      await t2.close();
    }
  });

  test('provedor não configurado: volta para o login com aviso', async () => {
    const t2 = await startTestApp();
    try {
      assert.equal((await t2.call('GET', '/api/config')).body.auth.google, false);
      const res = await t2.call('GET', '/auth/google', { raw: true });
      assert.match(res.headers.get('location'), /erro=indisponivel_google/);
      assert.match((await t2.call('GET', '/auth/inventado', { raw: true })).headers.get('location'), /erro=falha/);
    } finally {
      await t2.close();
    }
  });
});
