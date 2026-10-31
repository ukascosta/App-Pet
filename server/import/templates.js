/**
 * Arquivos para download: modelo oficial (XLSX/CSV), relatório de erros, planilha com
 * apontamentos para correção e exportação de uma viagem no mesmo formato da importação.
 */
import ExcelJS from 'exceljs';
import { sheetsFor, ALL_ENTITIES } from '../domain/entities.js';
import { toCsv } from './workbook.js';

const TYPE_LABEL = {
  text: 'Texto',
  id: 'Identificador (sem espaços)',
  date: 'Data AAAA-MM-DD ou DD/MM/AAAA',
  time: 'Hora HH:MM (24h)',
  datetime: 'Data e hora local AAAA-MM-DD HH:MM',
  email: 'E-mail',
  url: 'Link https://',
  int: 'Número inteiro',
  decimal: 'Número decimal',
  bool: 'sim / não',
  timezone: 'Fuso IANA (ex.: Europe/Rome)',
  phone: 'Telefone com DDD',
  tags: 'Lista separada por vírgulas',
  enum: 'Uma opção da lista',
  airport: 'Código IATA (3 letras)',
  source: 'Nome do arquivo anexado ou link https',
};

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
const REQUIRED_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C2D12' } };
const ERROR_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFECACA' } };
const WARNING_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };

function enumOptions(c, settings) {
  if (c.type === 'bool') return ['sim', 'não'];
  if (c.type !== 'enum') return null;
  const opts = typeof c.options === 'string' ? settings[c.options] : c.options;
  return opts.map((o) => o.key);
}

function styleHeader(ws, entity) {
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  entity.columns.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.fill = c.required && !c.requiredUnless ? REQUIRED_FILL : HEADER_FILL;
    cell.note = `${c.label}${c.required ? ' (obrigatório)' : ''}\n${TYPE_LABEL[c.type]}\n${c.help}\nEx.: ${c.example}`;
    ws.getColumn(i + 1).width = Math.max(14, Math.min(40, c.key.length + 6));
  });
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

function addValidations(ws, entity, settings, rows = 500) {
  entity.columns.forEach((c, i) => {
    const opts = enumOptions(c, settings);
    if (!opts) return;
    const list = `"${opts.join(',')}"`;
    if (list.length > 255) return;
    const letter = ws.getColumn(i + 1).letter;
    for (let r = 2; r <= rows + 1; r++) {
      ws.getCell(`${letter}${r}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [list],
        showErrorMessage: false,
      };
    }
  });
}

/** Modelo oficial: LEIA-ME + CAMPOS + uma aba por entidade (só cabeçalhos). */
export async function buildTemplateXlsx(kind, settings) {
  const entities = sheetsFor(kind);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Vagari';
  const readme = wb.addWorksheet('LEIA-ME');
  readme.getColumn(1).width = 110;
  const lines =
    kind === 'content'
      ? [
          'MODELO DE CONTEÚDO — VAGARI (destinos, lugares e imagens)',
          '',
          '1. Preencha só as abas que precisar. Abas vazias são ignoradas.',
          '2. Não renomeie as abas nem as colunas. Colunas em vermelho-escuro são obrigatórias.',
          '3. destination_id e content_id são IDs estáveis: se já existirem, o registro é ATUALIZADO; se não, é CRIADO.',
          '4. Nada é apagado por ausência na planilha. Célula vazia mantém o valor atual; escreva [limpar] para apagar um campo.',
          '5. TODO lugar importado entra como "Pendente de revisão" e só aparece no app depois de aprovado no painel.',
          '6. Não invente dados: se não confirmou horário, preço ou endereço, deixe vazio e explique em verification_notes.',
          '7. Imagens: anexe os arquivos no upload com o mesmo nome da coluna image_url_or_upload_name, e informe os direitos de uso.',
          '8. A aba CAMPOS explica cada coluna, formato e exemplo.',
        ]
      : [
          'MODELO DE VIAGEM — VAGARI',
          '',
          '1. Preencha só as abas que precisar. Abas vazias são ignoradas.',
          '2. Não renomeie as abas nem as colunas. Colunas em vermelho-escuro são obrigatórias.',
          '3. trip_id é o ID estável da viagem: se já existir, a viagem é ATUALIZADA; se não, é CRIADA.',
          '4. Voos são identificados por trip_id + segment_order. Hospedagens, roteiro, documentos e tarefas podem ter um ID',
          '   opcional (accommodation_id, item_id, document_id, task_id): use-o para atualizar sem duplicar.',
          '5. Nada é apagado por ausência na planilha. Célula vazia mantém o valor atual; escreva [limpar] para apagar um campo.',
          '6. Datas e horas são sempre no horário LOCAL do lugar (voo: hora local de cada aeroporto).',
          '7. Documentos: anexe os PDFs/imagens no upload com o mesmo nome da coluna file_url_or_upload_name.',
          '8. Antes de gravar, o painel mostra uma prévia com o que será criado/atualizado e os erros por linha e coluna.',
          '9. A aba CAMPOS explica cada coluna, formato e exemplo.',
        ];
  lines.forEach((l, i) => {
    readme.getCell(`A${i + 1}`).value = l;
    if (i === 0) readme.getCell('A1').font = { bold: true, size: 14 };
  });

  const fields = wb.addWorksheet('CAMPOS');
  fields.columns = [
    { header: 'Aba', key: 'sheet', width: 18 },
    { header: 'Coluna', key: 'key', width: 26 },
    { header: 'Obrigatório', key: 'required', width: 12 },
    { header: 'Formato', key: 'type', width: 34 },
    { header: 'Opções', key: 'options', width: 40 },
    { header: 'Exemplo', key: 'example', width: 28 },
    { header: 'Explicação', key: 'help', width: 70 },
  ];
  fields.getRow(1).font = { bold: true };
  for (const e of entities) {
    for (const c of e.columns) {
      fields.addRow({
        sheet: e.sheet,
        key: c.key,
        required: c.required ? (c.requiredUnless ? 'condicional' : 'sim') : 'não',
        type: TYPE_LABEL[c.type],
        options: (enumOptions(c, settings) || []).join(', '),
        example: c.example,
        help: c.help,
      });
    }
  }

  for (const e of entities) {
    const ws = wb.addWorksheet(e.sheet);
    ws.addRow(e.columns.map((c) => c.key));
    styleHeader(ws, e);
    addValidations(ws, e, settings);
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export function buildTemplateCsv(sheet) {
  const e = ALL_ENTITIES.find((x) => x.sheet === sheet);
  if (!e) return null;
  return toCsv([e.columns.map((c) => c.key)]);
}

function allIssues(job) {
  const out = [];
  for (const i of job.preview.fileIssues || []) out.push({ sheet: i.sheet || '', row: '', column: '', value: '', ...i, file: i.file });
  for (const s of job.preview.sheets) {
    for (const r of s.rows) for (const i of r.issues) out.push({ sheet: s.sheet, row: r.row, column: i.column || '', value: i.value ?? '', ...i });
  }
  return out;
}

const SEVERITY = { error: 'ERRO', warning: 'AVISO' };

export function buildErrorReportCsv(job) {
  const rows = [['aba', 'linha', 'coluna', 'valor', 'gravidade', 'problema', 'como corrigir']];
  for (const i of allIssues(job)) rows.push([i.sheet, i.row, i.column, i.value, SEVERITY[i.severity], i.message, i.hint || '']);
  return toCsv(rows);
}

/** Devolve a planilha enviada com uma coluna ERROS e as células com problema destacadas. */
export async function buildAnnotatedXlsx(job, parsed) {
  const wb = new ExcelJS.Workbook();
  const bySheet = Object.fromEntries(job.preview.sheets.map((s) => [s.sheet, s]));
  for (const [sheet, data] of Object.entries(parsed.original)) {
    const ws = wb.addWorksheet(sheet);
    const headers = [...data.headers, 'ERROS'];
    ws.addRow(headers);
    ws.getRow(1).font = { bold: true };
    const planned = new Map((bySheet[sheet]?.rows || []).map((r) => [r.row, r]));
    const colIndex = (key) => data.headerKeys.indexOf(key) + 1;
    for (const r of data.rows) {
      const p = planned.get(r.row);
      const messages = (p?.issues || []).map((i) => `${SEVERITY[i.severity]}${i.column ? ` [${i.column}]` : ''}: ${i.message}${i.hint ? ` ${i.hint}` : ''}`);
      const added = ws.addRow([...r.original.map(reviveCell), messages.join('\n')]);
      for (const i of p?.issues || []) {
        const idx = i.column ? colIndex(i.column) : 0;
        if (idx > 0) added.getCell(idx).fill = i.severity === 'error' ? ERROR_FILL : WARNING_FILL;
      }
      if (messages.length) added.getCell(headers.length).alignment = { wrapText: true, vertical: 'top' };
    }
    ws.getColumn(headers.length).width = 80;
    ws.views = [{ state: 'frozen', ySplit: 1 }];
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Exporta uma viagem no formato do modelo (com os IDs estáveis), para editar e reimportar. */
export async function buildTripExport(db, tripId, entitiesBySheet, settings) {
  const wb = new ExcelJS.Workbook();
  const queries = {
    TRIPS: ['SELECT * FROM trips WHERE id = ?'],
    TRAVELERS: [
      `SELECT tt.*, u.email, u.name, u.phone, u.nationality FROM trip_travelers tt JOIN users u ON u.id = tt.user_id WHERE tt.trip_id = ? ORDER BY tt.created_at`,
    ],
    FLIGHTS: ['SELECT * FROM flight_segments WHERE trip_id = ? ORDER BY segment_order'],
    ACCOMMODATIONS: ['SELECT * FROM accommodations WHERE trip_id = ? ORDER BY checkin_at'],
    ITINERARY: ['SELECT * FROM itinerary_items WHERE trip_id = ? ORDER BY date, start_time'],
    DOCUMENTS: ['SELECT * FROM documents WHERE trip_id = ? ORDER BY created_at'],
    TASKS: ["SELECT * FROM tasks WHERE trip_id = ? AND source != 'rule' ORDER BY due_date"],
  };
  for (const [sheet, [sql]] of Object.entries(queries)) {
    const e = entitiesBySheet[sheet];
    const ws = wb.addWorksheet(sheet);
    ws.addRow(e.columns.map((c) => c.key));
    for (const row of db.prepare(sql).all(tripId)) {
      const v = e.fromDb(row);
      ws.addRow(
        e.columns.map((c) => {
          const x = v[c.key];
          if (x === null || x === undefined) return '';
          if (typeof x === 'boolean') return x ? 'sim' : 'não';
          if (Array.isArray(x)) return x.join(', ');
          if (c.type === 'datetime') return String(x).replace('T', ' ');
          return x;
        }),
      );
    }
    styleHeader(ws, e);
    addValidations(ws, e, settings, 200);
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// Células originais são guardadas em JSON; datas viram {$date}.
export function serializeCell(v) {
  if (v instanceof Date) return { $date: v.toISOString() };
  return v;
}
export function reviveCell(v) {
  if (v && typeof v === 'object' && v.$date) return new Date(v.$date);
  if (v && typeof v === 'object' && 'hyperlink' in v) return v.hyperlink || v.text;
  return v;
}
