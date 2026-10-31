import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { authRoutes } from './routes/auth.js';
import { customerRoutes } from './routes/customer.js';
import { publicRoutes } from './routes/public.js';
import { storeRoutes } from './routes/store.js';
import { customerAuth, errorHandler, securityHeaders, storeAuth } from './middleware.js';
import { storeFeatureRoutes, tutorRoutes } from './features/api.js';
import { mountRoutes, queryOf } from './features/express.js';
import { sqliteRepo } from './features/repo-sqlite.js';
import { settingsOf } from './features/settings.js';
import { createAuthService } from './services/auth.js';
import { createOAuth } from './services/oauth.js';

const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

/** Monta o app Express. Todas as dependências entram por parâmetro para facilitar os testes. */
export function createApp({ config, db, alerts, whatsapp, push, now = Date.now, log = console, fetchFn }) {
  const app = express();
  const auth = createAuthService({ db, now });
  const oauth = createOAuth({ config, fetchFn });
  const { api: authApi, pages: authPages } = authRoutes({ db, config, auth, oauth, alerts, now, log });
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', config.trustProxy);

  app.use(securityHeaders);
  app.use(express.json({ limit: '20kb' }));

  app.use('/api', publicRoutes({ config, push, oauth }));
  app.use('/api', authApi);
  app.use('/api', customerRoutes({ db, alerts, now }));
  app.use('/auth', authPages);
  app.use('/api/store', storeRoutes({ db, config, whatsapp, now }));

  // Clube, vitrine, pedidos, pontos, agenda (tutor) e o painel administrativo (loja).
  const repo = sqliteRepo(db);
  const hooks = {
    notify: (customerId, msg) => alerts.notifyCustomer?.(customerId, msg),
    restock: (petId, kg) => alerts.restockPet?.(petId, kg),
    storeNotice: (text) => log.info(`[loja] ${text}`),
  };
  const ctxOf = (req) => ({
    repo, customer: req.customer, body: req.body ?? {}, query: queryOf(req), params: req.params, now: now(), settings: settingsOf(repo), hooks,
    store: { name: config.store.name, whatsapp: config.store.whatsapp },
  });
  app.use('/api', mountRoutes(tutorRoutes, ctxOf, [customerAuth(db)]));
  app.use('/api/store', storeAuth(config), mountRoutes(storeFeatureRoutes, ctxOf));
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));
  app.get('/painel', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'loja.html')));

  // O service worker precisa ser revalidado sempre para as atualizações do app chegarem.
  app.get('/sw.js', (_req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.sendFile(path.join(PUBLIC_DIR, 'sw.js'));
  });
  app.get('/loja', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'loja.html')));
  app.use(express.static(PUBLIC_DIR, { extensions: ['html'], maxAge: config.isProd ? '1h' : 0 }));

  app.use(errorHandler(log));
  return app;
}
