// Clube Pet: assinatura mensal. O pagamento é combinado pela loja (o app não cobra cartão).

import { DAY } from './settings.js';

export function activeSubscription(repo, customerId, now) {
  return repo.all('club_subscriptions', { customer_id: customerId })
    .find((s) => s.status === 'active' && (!s.renews_at || s.renews_at > now)) ?? null;
}
export const isMember = (repo, customerId, now) => Boolean(activeSubscription(repo, customerId, now));

export function pendingSubscription(repo, customerId) {
  return repo.all('club_subscriptions', { customer_id: customerId }).find((s) => s.status === 'pending') ?? null;
}

export function activate(repo, sub, now) {
  return repo.update('club_subscriptions', sub.id, { status: 'active', started_at: sub.started_at ?? now, renews_at: now + 30 * DAY });
}

export function benefits(settings) {
  return {
    free: ['Lembretes de reposição', 'Cadastro dos pets', 'Histórico de compras', 'Acesso à vitrine e promoções'],
    club: [
      `${settings.clubProductDiscount}% de desconto em produtos selecionados`,
      `${settings.clubServiceDiscount}% de desconto em banho e tosa`,
      `Frete grátis em compras acima de R$ ${(settings.freeShippingMinCents / 100).toFixed(0)}`,
      'Brinde no mês de aniversário do pet',
      'Ofertas exclusivas',
      'Pontuação em dobro nas compras',
    ],
  };
}
