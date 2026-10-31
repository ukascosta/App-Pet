// Regras comerciais configuráveis pela loja (painel › Configurações). Valores em centavos.

export const DEFAULT_SETTINGS = {
  clubPriceCents: 1990, // Clube Pet: R$ 19,90/mês
  clubProductDiscount: 5, // % em produtos selecionados
  clubServiceDiscount: 10, // % em banho e tosa
  clubPointsMultiplier: 2, // pontuação em dobro
  freeShippingMinCents: 15000, // frete grátis (clube) a partir de R$ 150
  shippingCents: 1200, // frete da entrega
  centsPerPoint: 1000, // 1 ponto a cada R$ 10
  pointsValidityDays: 365, // pontos vencem em 12 meses
  pointsDiscountBlock: 50, // 50 pontos…
  pointsDiscountCents: 1000, // …= R$ 10 de desconto
  referralPoints: 20, // indicação: pontos após a 1ª compra confirmada do indicado
  recoveryDays: 45, // cliente sem compra há X dias vira "recuperação"
  careLeadDays: 3, // lembrete de cuidados X dias antes
};

export const settingsOf = (repo) => ({ ...DEFAULT_SETTINGS, ...(repo.setting('commerce') ?? {}) });

export const DAY = 86_400_000;
export const money = (cents) => `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
