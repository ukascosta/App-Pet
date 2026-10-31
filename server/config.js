import crypto from 'node:crypto';

/** Lê a configuração a partir de variáveis de ambiente. Tudo que é de negócio fica no painel (tabela settings). */
export function loadConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV || 'development';
  const isProd = nodeEnv === 'production';
  const secret = env.APP_SECRET || (isProd ? '' : crypto.randomBytes(32).toString('hex'));
  if (isProd && secret.length < 32) {
    throw new Error('APP_SECRET é obrigatório em produção (mínimo 32 caracteres).');
  }
  return {
    env: nodeEnv,
    isProd,
    port: Number(env.PORT || 3000),
    publicUrl: (env.PUBLIC_URL || 'http://localhost:3000').replace(/\/$/, ''),
    databasePath: env.DATABASE_PATH || 'data/vagari.db',
    storageDir: env.STORAGE_DIR || 'data/files',
    tmpDir: env.TMP_DIR || 'data/tmp',
    secret,
    // E-mails que viram administradores no primeiro acesso (bootstrap da equipe).
    adminEmails: (env.ADMIN_EMAILS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
    smtpUrl: env.SMTP_URL || '',
    mailFrom: env.MAIL_FROM || 'Vagari <nao-responda@vagari.com.br>',
    // Ambiente de demonstração: dados fictícios, nunca misturados com dados reais.
    demoMode: env.DEMO_MODE === '1',
    sessionDays: Number(env.SESSION_DAYS || 30),
    loginCodeMinutes: 10,
    schedulerMinutes: Number(env.SCHEDULER_MINUTES || 15),
    maxUploadMb: Number(env.MAX_UPLOAD_MB || 25),
  };
}
