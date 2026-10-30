// Login com Google e Facebook (fluxo OAuth 2.0 "authorization code", feito pelo servidor).
// Não usa SDK nem script de terceiros: o navegador só é redirecionado para o provedor e volta.

const TIMEOUT_MS = 15_000;

async function json(res, what) {
  if (!res.ok) throw new Error(`${what}: HTTP ${res.status}`);
  return res.json();
}

export function createOAuth({ config, fetchFn = fetch }) {
  const redirectUri = (name) => `${config.publicUrl}/auth/${name}/callback`;
  const signal = () => AbortSignal.timeout(TIMEOUT_MS);

  const google = {
    enabled: Boolean(config.auth.google.clientId && config.auth.google.clientSecret),
    authorizeUrl(state) {
      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      url.search = new URLSearchParams({
        client_id: config.auth.google.clientId,
        redirect_uri: redirectUri('google'),
        response_type: 'code',
        scope: 'openid email profile',
        state,
        prompt: 'select_account',
      });
      return url.toString();
    },
    async profile(code) {
      const token = await json(
        await fetchFn('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: config.auth.google.clientId,
            client_secret: config.auth.google.clientSecret,
            redirect_uri: redirectUri('google'),
            grant_type: 'authorization_code',
          }),
          signal: signal(),
        }),
        'google token',
      );
      const info = await json(
        await fetchFn('https://openidconnect.googleapis.com/v1/userinfo', {
          headers: { Authorization: `Bearer ${token.access_token}` },
          signal: signal(),
        }),
        'google userinfo',
      );
      return { id: String(info.sub), email: info.email?.toLowerCase() ?? null, emailVerified: info.email_verified === true, name: info.name || info.email };
    },
  };

  const facebook = {
    enabled: Boolean(config.auth.facebook.appId && config.auth.facebook.appSecret),
    authorizeUrl(state) {
      const url = new URL('https://www.facebook.com/v21.0/dialog/oauth');
      url.search = new URLSearchParams({
        client_id: config.auth.facebook.appId,
        redirect_uri: redirectUri('facebook'),
        response_type: 'code',
        scope: 'email,public_profile',
        state,
      });
      return url.toString();
    },
    async profile(code) {
      const tokenUrl = new URL('https://graph.facebook.com/v21.0/oauth/access_token');
      tokenUrl.search = new URLSearchParams({
        client_id: config.auth.facebook.appId,
        client_secret: config.auth.facebook.appSecret,
        redirect_uri: redirectUri('facebook'),
        code,
      });
      const token = await json(await fetchFn(tokenUrl, { signal: signal() }), 'facebook token');
      const meUrl = new URL('https://graph.facebook.com/v21.0/me');
      meUrl.search = new URLSearchParams({ fields: 'id,name,email', access_token: token.access_token });
      const me = await json(await fetchFn(meUrl, { signal: signal() }), 'facebook me');
      // O Facebook só devolve o e-mail quando ele foi confirmado pelo usuário na própria conta.
      return { id: String(me.id), email: me.email?.toLowerCase() ?? null, emailVerified: Boolean(me.email), name: me.name || me.email };
    },
  };

  const providers = { google, facebook };
  return {
    names: Object.keys(providers),
    has: (name) => Object.hasOwn(providers, name),
    isEnabled: (name) => providers[name]?.enabled === true,
    authorizeUrl: (name, state) => providers[name].authorizeUrl(state),
    profile: (name, code) => providers[name].profile(code),
  };
}
