import { createApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDatabase } from '../server/db.js';
import { createAlertService } from '../server/services/alerts.js';
import { createPushService } from '../server/services/push.js';

export const T0 = Date.UTC(2026, 5, 1, 12);
export const DAY = 86_400_000;

/** App completo com banco em memória, relógio controlável e WhatsApp/e-mail simulados. */
export async function startTestApp(envOverrides = {}) {
  const clock = { t: T0, now: () => clock.t, advanceDays(d) { clock.t += d * DAY; } };
  const config = loadConfig({
    STORE_NAME: 'Pet Shop Teste',
    STORE_WHATSAPP: '(11) 98888-7777',
    STORE_ADMIN_PASSWORD: 'segredo',
    ...envOverrides,
  });
  const db = openDatabase(':memory:');

  const sentWhatsApp = [];
  const sentEmails = [];
  const whatsapp = {
    name: 'fake',
    failNext: 0,
    async send(msg) {
      if (this.failNext > 0) {
        this.failNext--;
        throw new Error('provedor fora do ar');
      }
      sentWhatsApp.push(msg);
    },
  };
  const mailer = { async send(m) { sentEmails.push(m); } };
  const push = createPushService({ db, config });
  const log = { info() {}, error() {} };
  const alerts = createAlertService({ db, config, whatsapp, push, mailer, now: clock.now, log });
  const app = createApp({ config, db, alerts, whatsapp, push, now: clock.now, log });

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  async function call(method, path, { body, token, storeKey } = {}) {
    const res = await fetch(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(storeKey ? { 'x-store-key': storeKey } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  }

  return {
    clock, db, alerts, call, sentWhatsApp, sentEmails, whatsapp, config,
    close: () => new Promise((resolve) => server.close(() => { db.close(); resolve(); })),
  };
}

export const validCustomer = (over = {}) => ({
  name: 'Maria Silva',
  email: 'maria@example.com',
  whatsapp: '(11) 99999-8888',
  consent: true,
  ...over,
});

export const validPet = (over = {}) => ({
  species: 'dog',
  breedId: 'labrador',
  name: 'Thor',
  color: 'Caramelo',
  ageYears: 3,
  ageMonths: 0,
  weightKg: 30,
  neutered: true,
  monthlyPurchaseKg: 10,
  dailyMode: 'recommended',
  ...over,
});
