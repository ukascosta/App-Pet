import { loadConfig } from './config.js';
import { createServices } from './services/index.js';
import { createApp } from './app.js';

const config = loadConfig();
const services = createServices(config);
const app = createApp(services);

if (config.demoMode) console.log('⚠️  AMBIENTE DE DEMONSTRAÇÃO: dados fictícios. Não use com dados reais.');
if (!config.adminEmails.length && !services.db.prepare("SELECT 1 FROM users WHERE role = 'admin'").get()) {
  console.log('Nenhum administrador. Defina ADMIN_EMAILS no .env para o primeiro acesso ao painel.');
}

/** Tarefas periódicas: lembretes, envio de e-mails e limpeza de prévias abandonadas. */
async function tick() {
  try {
    services.notifications.runTaskReminders(services.settings.get('reminder_days_before'));
    await services.notifications.dispatchEmails();
    services.imports.expireOld();
  } catch (e) {
    console.error('Falha nas tarefas periódicas:', e);
  }
}
setInterval(tick, config.schedulerMinutes * 60_000).unref();
setTimeout(tick, 5_000).unref();
setInterval(() => services.notifications.dispatchEmails().catch(() => {}), 60_000).unref();

app.listen(config.port, () => console.log(`Vagari rodando em ${config.publicUrl} (porta ${config.port})`));
