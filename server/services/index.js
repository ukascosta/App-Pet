import { openDatabase } from '../db.js';
import { createSettings } from './settings.js';
import { createStorage } from './storage.js';
import { createMailer } from './mailer.js';
import { createAuth } from './auth.js';
import { createNotifications } from './notifications.js';
import { createImports } from './imports.js';
import { seedDefaultRules } from './checklist.js';

/** Monta todos os serviços. Os testes passam db/mailer/now próprios. */
export function createServices(config, overrides = {}) {
  const log = overrides.log || console;
  const now = overrides.now || (() => Date.now());
  const db = overrides.db || openDatabase(config.databasePath);
  const settings = createSettings(db);
  const storage = overrides.storage || createStorage(config.storageDir);
  const mailer = overrides.mailer || createMailer(config, log);
  seedDefaultRules(db);
  const services = { db, config, settings, storage, mailer, log, now };
  services.auth = createAuth(services);
  services.notifications = createNotifications(services);
  services.imports = createImports(services);
  return services;
}
