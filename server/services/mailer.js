import nodemailer from 'nodemailer';

/** E-mail para o tutor. Sem SMTP_URL, o canal fica desligado (itens da fila viram "skipped"). */
export function createMailer(config) {
  if (!config.smtpUrl) return null;
  const transport = nodemailer.createTransport(config.smtpUrl);
  const from = config.mailFrom || `${config.store.name} <no-reply@localhost>`;

  return {
    async send({ to, subject, text }) {
      await transport.sendMail({ from, to, subject, text });
    },
  };
}
