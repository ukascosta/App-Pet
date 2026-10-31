import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { HttpError, authenticate, originCheck, securityHeaders } from './http.js';
import { ValidationError } from './domain/crud.js';
import { authRoutes } from './routes/auth.js';
import { adminTripRoutes } from './routes/admin-trips.js';
import { adminContentRoutes } from './routes/admin-content.js';
import { adminImportRoutes } from './routes/admin-imports.js';
import { adminSystemRoutes } from './routes/admin-system.js';
import { travelerRoutes, signedFileRoute } from './routes/traveler.js';

/**
 * services: { db, config, settings, storage, auth, mailer, notifications, imports, now?, log? }
 * O frontend (app do viajante e painel) será servido aqui na etapa de UI.
 */
export function createApp(services) {
  const { config, log = console } = services;
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(securityHeaders);
  app.use(express.json({ limit: '1mb' }));
  app.use(authenticate(services.auth));
  app.use(originCheck(config));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.get('/api/config', (_req, res) =>
    res.json({ agency_name: services.settings.get('agency_name'), demo: config.demoMode, environment: config.demoMode ? 'demo' : config.env }),
  );

  app.use('/api/auth', authRoutes(services));
  app.use('/api/admin', adminSystemRoutes(services));
  app.use('/api/admin', adminImportRoutes(services));
  app.use('/api/admin', adminContentRoutes(services));
  app.use('/api/admin', adminTripRoutes(services));
  const traveler = travelerRoutes(services);
  app.use('/api', traveler.router);
  app.get('/files/:docId', signedFileRoute(services, traveler.canSeeDocument, services.now));

  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Rota não encontrada.')));

  // Painel da equipe (apps/admin, gerado com "npm run build:admin").
  const adminDist = path.resolve(config.adminDistDir || 'apps/admin/dist');
  if (fs.existsSync(path.join(adminDist, 'index.html'))) {
    app.use('/painel', express.static(adminDist, { index: 'index.html', maxAge: '1h' }));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    if (err instanceof ValidationError) return res.status(422).json({ error: 'Confira os campos destacados.', issues: err.issues });
    if (err instanceof HttpError) {
      const { status, message, ...extra } = err;
      return res.status(status).json({ error: message, ...extra });
    }
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido.' });
    if (err?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: `Arquivo maior que ${config.maxUploadMb} MB.` });
    if (err?.name === 'MulterError') return res.status(400).json({ error: `Upload inválido: ${err.message}` });
    log.error?.(`${req.method} ${req.originalUrl}: ${err?.stack || err}`);
    res.status(500).json({ error: 'Erro interno. Tente de novo; se persistir, avise a equipe técnica.' });
  });
  return app;
}
