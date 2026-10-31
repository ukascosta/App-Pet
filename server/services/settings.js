import { nowIso } from '../lib/time.js';

/**
 * Parâmetros configuráveis pelo painel (PRD §16.7): WhatsApp, textos, categorias, prazos.
 * Os valores padrão abaixo são só o ponto de partida; o painel sobrescreve.
 */
export const DEFAULT_SETTINGS = {
  agency_name: 'Vagari',
  // Número oficial com DDI e DDD, só dígitos (ex.: 5511999990000). Vazio = botão de ajuda desativado.
  whatsapp_number: '',
  // Variáveis: {nome}, {viagem}, {codigo}, {destino}
  whatsapp_message:
    'Olá, Vagari! Sou {nome}, da viagem "{viagem}" ({codigo}) para {destino}. Preciso de ajuda com: ',
  // Só ligue se houver equipe/plantão cobrindo as 24 horas (PRD §4.7).
  support_24h: false,
  support_hours_text: 'Segunda a sexta, das 9h às 18h (horário de Brasília).',
  home_country: 'Brasil',
  invite_expiry_days: 14,
  reminder_days_before: 3,
  trip_types: [
    { key: 'lazer', label: 'Lazer' },
    { key: 'lua_de_mel', label: 'Lua de mel' },
    { key: 'familia', label: 'Família' },
    { key: 'aventura', label: 'Aventura' },
    { key: 'gastronomia', label: 'Gastronomia' },
    { key: 'negocios', label: 'Negócios' },
  ],
  itinerary_categories: [
    { key: 'transfer', label: 'Transfer' },
    { key: 'passeio', label: 'Passeio' },
    { key: 'experiencia', label: 'Experiência' },
    { key: 'restaurante', label: 'Restaurante' },
    { key: 'ingresso', label: 'Ingresso / atração' },
    { key: 'transporte', label: 'Trem / ônibus / carro' },
    { key: 'livre', label: 'Tempo livre' },
    { key: 'outro', label: 'Outro' },
  ],
  booking_statuses: [
    { key: 'confirmado', label: 'Confirmado', aliases: ['confirmed', 'ok'] },
    { key: 'pendente', label: 'Pendente', aliases: ['pending'] },
    { key: 'nao_necessario', label: 'Não precisa de reserva', aliases: ['not_required', 'livre'] },
    { key: 'cancelado', label: 'Cancelado', aliases: ['canceled', 'cancelled'] },
  ],
  document_categories: [
    { key: 'voucher', label: 'Voucher' },
    { key: 'bilhete', label: 'Bilhete aéreo', aliases: ['passagem', 'e-ticket', 'ticket'] },
    { key: 'reserva', label: 'Reserva / hospedagem', aliases: ['hotel'] },
    { key: 'seguro', label: 'Seguro viagem', aliases: ['insurance'] },
    { key: 'ingresso', label: 'Ingresso' },
    { key: 'orientacao', label: 'Orientações', aliases: ['guia', 'roteiro'] },
    { key: 'outro', label: 'Outro' },
  ],
  document_stages: [
    { key: 'antes', label: 'Antes de viajar' },
    { key: 'ida', label: 'Ida' },
    { key: 'destino', label: 'No destino' },
    { key: 'volta', label: 'Volta' },
  ],
  place_categories: [
    { key: 'ponto_turistico', label: 'Pontos turísticos', aliases: ['atracao', 'pontos turisticos'] },
    { key: 'museu_cultura', label: 'Museus e cultura', aliases: ['museu', 'cultura'] },
    { key: 'restaurante', label: 'Restaurantes', aliases: ['restaurant'] },
    { key: 'cafe', label: 'Cafés', aliases: ['cafes'] },
    { key: 'bar', label: 'Bares', aliases: ['bares'] },
    { key: 'experiencia', label: 'Experiências', aliases: ['experiencias'] },
    { key: 'compras', label: 'Compras', aliases: ['loja', 'lojas'] },
    { key: 'servicos', label: 'Serviços úteis', aliases: ['servico', 'servicos uteis'] },
  ],
  interests: [
    { key: 'gastronomia', label: 'Gastronomia' },
    { key: 'cultura', label: 'Cultura' },
    { key: 'natureza', label: 'Natureza' },
    { key: 'compras', label: 'Compras' },
    { key: 'aventura', label: 'Aventura' },
    { key: 'descanso', label: 'Descanso' },
  ],
};

/** Chaves que o viajante pode ver (o resto é interno). */
const PUBLIC_KEYS = [
  'agency_name',
  'support_24h',
  'support_hours_text',
  'trip_types',
  'itinerary_categories',
  'booking_statuses',
  'document_categories',
  'document_stages',
  'place_categories',
  'interests',
];

export function createSettings(db) {
  const getStmt = db.prepare('SELECT key, value FROM settings');
  const upsert = db.prepare(`
    INSERT INTO settings (key, value, updated_at, updated_by) VALUES (?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by
  `);

  function all() {
    const out = structuredClone(DEFAULT_SETTINGS);
    for (const row of getStmt.all()) {
      try {
        out[row.key] = JSON.parse(row.value);
      } catch {
        /* valor corrompido: mantém o padrão */
      }
    }
    return out;
  }

  return {
    all,
    get: (key) => all()[key],
    publicView() {
      const s = all();
      return Object.fromEntries(PUBLIC_KEYS.map((k) => [k, s[k]]));
    },
    /** Grava só chaves conhecidas, com validação simples de tipo. Retorna {before, after}. */
    update(patch, actorId) {
      const before = all();
      const errors = [];
      for (const [key, value] of Object.entries(patch)) {
        if (!(key in DEFAULT_SETTINGS)) {
          errors.push(`Configuração desconhecida: ${key}`);
          continue;
        }
        const err = validateSetting(key, value);
        if (err) errors.push(err);
      }
      if (errors.length) return { errors };
      db.transaction(() => {
        for (const [key, value] of Object.entries(patch)) {
          upsert.run(key, JSON.stringify(value), nowIso(), actorId || null);
        }
      })();
      return { before, after: all() };
    },
  };
}

function validateSetting(key, value) {
  const def = DEFAULT_SETTINGS[key];
  if (Array.isArray(def)) {
    if (!Array.isArray(value) || !value.length) return `${key}: informe uma lista com pelo menos um item.`;
    const keys = new Set();
    for (const item of value) {
      if (!item || typeof item.key !== 'string' || !/^[a-z0-9_]{1,40}$/.test(item.key))
        return `${key}: cada item precisa de "key" com letras minúsculas, números ou _.`;
      if (typeof item.label !== 'string' || !item.label.trim()) return `${key}: cada item precisa de "label".`;
      if (keys.has(item.key)) return `${key}: chave repetida "${item.key}".`;
      keys.add(item.key);
    }
    return null;
  }
  if (typeof def === 'boolean' && typeof value !== 'boolean') return `${key}: use true ou false.`;
  if (typeof def === 'number' && (!Number.isInteger(value) || value < 0 || value > 365))
    return `${key}: use um número inteiro entre 0 e 365.`;
  if (typeof def === 'string' && typeof value !== 'string') return `${key}: use um texto.`;
  if (key === 'whatsapp_number' && value && !/^\d{10,15}$/.test(value))
    return 'whatsapp_number: use só dígitos com DDI e DDD (ex.: 5511999990000).';
  return null;
}
