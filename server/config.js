import crypto from 'node:crypto';
import { normalizeWhatsApp } from './lib/phone.js';

const int = (value, fallback) => {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
};

export function loadConfig(env = process.env) {
  const isProd = env.NODE_ENV === 'production';

  let adminPassword = env.STORE_ADMIN_PASSWORD || '';
  let generatedAdminPassword = false;
  if (!adminPassword) {
    if (isProd) throw new Error('Defina STORE_ADMIN_PASSWORD para rodar em produção (senha do painel da loja).');
    adminPassword = crypto.randomBytes(6).toString('hex');
    generatedAdminPassword = true;
  }

  const storeWhatsapp = env.STORE_WHATSAPP ? normalizeWhatsApp(env.STORE_WHATSAPP) : null;
  if (env.STORE_WHATSAPP && !storeWhatsapp) {
    throw new Error('STORE_WHATSAPP inválido. Use DDD + número, ex.: 11999998888.');
  }

  const port = int(env.PORT, 3000);
  return {
    isProd,
    port,
    // Endereço público do app (usado nos links dos e-mails e no retorno do login social).
    publicUrl: (env.PUBLIC_URL || `http://localhost:${port}`).replace(/\/+$/, ''),
    auth: {
      google: { clientId: env.GOOGLE_CLIENT_ID || '', clientSecret: env.GOOGLE_CLIENT_SECRET || '' },
      facebook: { appId: env.FACEBOOK_APP_ID || '', appSecret: env.FACEBOOK_APP_SECRET || '' },
    },
    // Atrás de proxy reverso (Nginx, Render, Railway...), use TRUST_PROXY=1 para ver o IP real.
    trustProxy: env.TRUST_PROXY ? int(env.TRUST_PROXY, 1) : false,
    dbPath: env.DATABASE_PATH || 'data/app-pet.db',
    checkIntervalMs: Math.max(1, int(env.CHECK_INTERVAL_MINUTES, 15)) * 60_000,
    store: {
      name: env.STORE_NAME || 'Pet Shop',
      whatsapp: storeWhatsapp,
      adminPassword,
      generatedAdminPassword,
    },
    whatsapp: {
      provider: env.WHATSAPP_PROVIDER || 'console',
      metaToken: env.WHATSAPP_META_TOKEN || '',
      metaPhoneNumberId: env.WHATSAPP_META_PHONE_NUMBER_ID || '',
      metaTemplate: env.WHATSAPP_META_TEMPLATE || '',
      metaTemplateLang: env.WHATSAPP_META_TEMPLATE_LANG || 'pt_BR',
      webhookUrl: env.WHATSAPP_WEBHOOK_URL || '',
      webhookToken: env.WHATSAPP_WEBHOOK_TOKEN || '',
    },
    smtpUrl: env.SMTP_URL || '',
    mailFrom: env.MAIL_FROM || '',
    vapid: {
      publicKey: env.VAPID_PUBLIC_KEY || '',
      privateKey: env.VAPID_PRIVATE_KEY || '',
      subject: env.VAPID_SUBJECT || 'mailto:contato@example.com',
    },
  };
}
