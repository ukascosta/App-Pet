// Textos das notificações (pt-BR).

import { formatWhatsApp, whatsAppLink } from '../lib/phone.js';

const fmtDays = (days) => {
  if (days <= 0) return 'a ração acabou';
  if (days < 1) return 'menos de 1 dia de ração';
  const n = Math.floor(days);
  return `${n} ${n === 1 ? 'dia' : 'dias'} de ração`;
};

/** Aviso para o tutor (push, e-mail e dentro do app). */
export function customerAlert({ petName, storeName, kind, daysLeft }) {
  if (kind === 'empty') {
    return {
      title: `A ração de ${petName} acabou`,
      body: `Faça a reposição o quanto antes. A loja já foi avisada e vai falar com você pelo WhatsApp.`,
    };
  }
  return {
    title: `A ração de ${petName} está acabando`,
    body: `Restam ${fmtDays(daysLeft)}. A loja já foi avisada e vai falar com você pelo WhatsApp.`,
  };
}

/** Mensagem que a loja recebe no WhatsApp. */
export function storeAlert({ customer, pet, kind, daysLeft, suggestedKg }) {
  const urgency = kind === 'empty' ? '🚨 *RAÇÃO ACABOU*' : '🐾 *Ração acabando*';
  const lines = [
    urgency,
    `Cliente: ${customer.name}`,
    `WhatsApp: ${formatWhatsApp(customer.whatsapp)}`,
    `Pet: ${pet.name} (${pet.breedName}, ${pet.color})`,
    kind === 'empty' ? 'Situação: sem ração em casa' : `Situação: ${fmtDays(daysLeft)}`,
    `Compra mensal: ${suggestedKg} kg`,
    '',
    `Falar com o cliente: ${whatsAppLink(customer.whatsapp)}`,
  ];
  return lines.join('\n');
}

/** Texto pronto para a loja abrir a conversa com o cliente. */
export function storeGreeting({ customerName, petName, storeName }) {
  const first = customerName.split(' ')[0];
  return `Olá, ${first}! Aqui é da loja ${storeName} 🐾 Vi que a ração de ${petName} está acabando. Posso separar o pedido de sempre para você?`;
}
