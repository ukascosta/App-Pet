import webpush from 'web-push';
import { getSetting, setSetting } from '../db.js';

/**
 * Chaves VAPID: vêm do ambiente ou são geradas uma vez e guardadas no banco,
 * para que as inscrições dos aparelhos continuem válidas depois de reiniciar.
 */
export function createPushService({ db, config }) {
  let { publicKey, privateKey } = config.vapid;
  if (!publicKey || !privateKey) {
    publicKey = getSetting(db, 'vapid_public');
    privateKey = getSetting(db, 'vapid_private');
    if (!publicKey || !privateKey) {
      ({ publicKey, privateKey } = webpush.generateVAPIDKeys());
      setSetting(db, 'vapid_public', publicKey);
      setSetting(db, 'vapid_private', privateKey);
    }
  }
  webpush.setVapidDetails(config.vapid.subject, publicKey, privateKey);

  return {
    publicKey,
    /** @returns {Promise<number>} quantos aparelhos receberam */
    async notifyCustomer(customerId, payload) {
      const subs = db.prepare('SELECT * FROM push_subscriptions WHERE customer_id = ?').all(customerId);
      let delivered = 0;
      for (const sub of subs) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify(payload),
            { TTL: 60 * 60 * 24 },
          );
          delivered++;
        } catch (err) {
          // 404/410: o aparelho cancelou a inscrição.
          if (err.statusCode === 404 || err.statusCode === 410) {
            db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(sub.id);
          } else {
            throw err;
          }
        }
      }
      return delivered;
    },
    hasSubscriptions: (customerId) =>
      db.prepare('SELECT 1 FROM push_subscriptions WHERE customer_id = ? LIMIT 1').get(customerId) !== undefined,
  };
}
