import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { openDatabase } from './db.js';
import { createAlertService, startScheduler } from './services/alerts.js';
import { createMailer } from './services/mailer.js';
import { createPushService } from './services/push.js';
import { createWhatsAppProvider } from './services/whatsapp.js';

const config = loadConfig();
const db = openDatabase(config.dbPath);
const whatsapp = createWhatsAppProvider(config.whatsapp);
const push = createPushService({ db, config });
const mailer = createMailer(config);
const alerts = createAlertService({ db, config, whatsapp, push, mailer });

const app = createApp({ config, db, alerts, whatsapp, push });
const server = app.listen(config.port, () => {
  console.log(`App Pet rodando em http://localhost:${config.port}`);
  console.log(`Painel da loja: http://localhost:${config.port}/loja`);
  if (config.store.generatedAdminPassword) {
    console.log(`Senha do painel (gerada agora; defina STORE_ADMIN_PASSWORD para fixar): ${config.store.adminPassword}`);
  }
  console.log(`WhatsApp da loja: ${whatsapp.name}${config.store.whatsapp ? '' : ' (STORE_WHATSAPP não configurado: avisos só aparecem no painel)'}`);
});

const stopScheduler = startScheduler(alerts, config.checkIntervalMs);

function shutdown() {
  stopScheduler();
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
