import nodemailer from 'nodemailer';

/** E-mail transacional por SMTP (qualquer provedor). Sem SMTP, só registra no log (desenvolvimento). */
export function createMailer(config, log = console) {
  if (!config.smtpUrl) {
    return {
      name: 'console',
      async send({ to, subject, text }) {
        log.info?.(`[e-mail simulado] para ${to}: ${subject}\n${text}`);
      },
    };
  }
  const transport = nodemailer.createTransport(config.smtpUrl);
  return {
    name: 'smtp',
    async send({ to, subject, text, html }) {
      await transport.sendMail({ from: config.mailFrom, to, subject, text, html });
    },
  };
}
