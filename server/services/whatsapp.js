// Envio de WhatsApp para a LOJA. Escolhido por WHATSAPP_PROVIDER:
//   console  -> só registra no log (padrão)
//   meta     -> WhatsApp Cloud API oficial (Meta)
//   webhook  -> POST JSON para Z-API / Evolution API / n8n / Make etc.
//
// Cada provedor expõe send({ to, text, data }) e lança erro se falhar
// (a fila em alerts.js tenta de novo mais tarde).

const TIMEOUT_MS = 15_000;

async function postJson(url, body, headers) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 300);
    throw new Error(`HTTP ${res.status} ${detail}`.trim());
  }
  return res;
}

function consoleProvider(log) {
  return {
    name: 'console',
    async send({ to, text }) {
      log.info(`[whatsapp:console] para ${to}\n${text}`);
    },
  };
}

function metaProvider(cfg) {
  if (!cfg.metaToken || !cfg.metaPhoneNumberId) {
    throw new Error('WHATSAPP_PROVIDER=meta exige WHATSAPP_META_TOKEN e WHATSAPP_META_PHONE_NUMBER_ID.');
  }
  const url = `https://graph.facebook.com/v21.0/${cfg.metaPhoneNumberId}/messages`;
  const headers = { Authorization: `Bearer ${cfg.metaToken}` };

  return {
    name: 'meta',
    async send({ to, text, data }) {
      // Fora da janela de 24h a Meta só aceita template aprovado.
      const message = cfg.metaTemplate
        ? {
            type: 'template',
            template: {
              name: cfg.metaTemplate,
              language: { code: cfg.metaTemplateLang },
              components: [
                {
                  type: 'body',
                  parameters: [data.customerName, data.petName, data.daysLabel, data.customerWhatsapp].map((v) => ({
                    type: 'text',
                    text: String(v),
                  })),
                },
              ],
            },
          }
        : { type: 'text', text: { body: text, preview_url: true } };

      await postJson(url, { messaging_product: 'whatsapp', to, ...message }, headers);
    },
  };
}

function webhookProvider(cfg) {
  if (!cfg.webhookUrl) throw new Error('WHATSAPP_PROVIDER=webhook exige WHATSAPP_WEBHOOK_URL.');
  const headers = cfg.webhookToken ? { Authorization: `Bearer ${cfg.webhookToken}` } : {};

  return {
    name: 'webhook',
    async send({ to, text, data }) {
      await postJson(cfg.webhookUrl, { event: 'low_stock', to, text, ...data }, headers);
    },
  };
}

export function createWhatsAppProvider(cfg, log = console) {
  switch (cfg.provider) {
    case 'console':
      return consoleProvider(log);
    case 'meta':
      return metaProvider(cfg);
    case 'webhook':
      return webhookProvider(cfg);
    default:
      throw new Error(`WHATSAPP_PROVIDER desconhecido: "${cfg.provider}" (use console, meta ou webhook).`);
  }
}
