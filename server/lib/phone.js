// WhatsApp: guardamos só dígitos com código do país (formato aceito por wa.me
// e pela API do WhatsApp), ex.: 5511999998888.

/**
 * Aceita "(11) 99999-8888", "11999998888", "+55 11 99999-8888".
 * Números brasileiros precisam ser celulares (DDD + 9 + 8 dígitos).
 * Outros países: informe com "+" e código do país.
 * @returns {string|null} dígitos normalizados ou null se inválido
 */
export function normalizeWhatsApp(input) {
  const raw = String(input ?? '').trim();
  const digits = raw.replace(/\D/g, '');
  const international = raw.startsWith('+') || raw.startsWith('00');

  if (international) {
    const intl = digits.replace(/^00/, '');
    if (intl.startsWith('55')) return validBrazil(intl.slice(2));
    return /^[1-9]\d{7,14}$/.test(intl) ? intl : null;
  }
  if (digits.startsWith('55') && digits.length >= 12) return validBrazil(digits.slice(2));
  return validBrazil(digits);
}

function validBrazil(national) {
  // DDD (11–99) + celular com 9 na frente
  return /^[1-9][1-9]9\d{8}$/.test(national) ? `55${national}` : null;
}

/** 5511999998888 -> (11) 99999-8888 (só para exibir) */
export function formatWhatsApp(digits) {
  const m = /^55(\d{2})(\d{5})(\d{4})$/.exec(digits);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : `+${digits}`;
}

export function whatsAppLink(digits, text) {
  const query = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${digits}${query}`;
}
