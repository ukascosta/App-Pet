/**
 * Prompt-base do PRD §7.4 para o Claude pesquisar destinos, já amarrado às colunas
 * exatas da aba PLACES e às categorias configuradas no painel.
 */
import { PLACES } from './entities.js';

export function researchPrompt({ city, country, destinationId, settings, today }) {
  const columns = PLACES.columns.map((c) => c.key).join(' | ');
  const categories = settings.place_categories.map((c) => `${c.key} (${c.label})`).join(', ');
  const dest = destinationId || '<destination_id da cidade na biblioteca Vagari>';
  return `Atue como pesquisador e editor de conteúdo de destinos para a Vagari, uma agência de experiências.

Pesquise a cidade ${city}, no país ${country}, e produza uma base de lugares úteis e experiências para viajantes.

Organize nas categorias (use exatamente a chave): ${categories}.
Priorize qualidade, relevância para visitantes e diversidade de orçamento.

Para cada item, retorne: nome, categoria, descrição ORIGINAL de até 350 caracteres, endereço, coordenadas quando disponíveis,
faixa de preço ($, $$, $$$ ou $$$$) somente se houver fonte confiável, horário de funcionamento somente se verificado,
site oficial, link de reserva oficial quando existir, URL da fonte consultada, data da verificação e observações de confiança.

Regras:
- Não invente dados. Se um campo não puder ser confirmado, deixe em branco e escreva em verification_notes qual campo está "não verificado".
- Não copie textos promocionais extensos.
- Evite duplicatas e lugares fechados permanentemente.
- Marque todo resultado como PENDENTE DE REVISÃO HUMANA (status = pendente).

Formato de entrega: uma tabela (ou CSV separado por ponto e vírgula) com EXATAMENTE estas colunas, nesta ordem:
${columns}

- content_id: identificador estável, minúsculo, sem espaços nem acentos (ex.: ${(destinationId || 'cidade')}-nome-do-lugar).
- destination_id: ${dest}
- tags: separadas por vírgula.
- last_verified_at: ${today}
- status: pendente

Observação: horários, preços, disponibilidade e regras de entrada mudam. A equipe Vagari revisa cada item antes de publicar.`;
}
