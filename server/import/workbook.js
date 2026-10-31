/**
 * Leitura de planilhas XLSX e CSV para o formato interno:
 *   { sheets: { [SHEET]: { source, headers, rows: [{ row, cells }] } }, issues: [...] }
 * O cabeçalho é a primeira linha preenchida. Linhas totalmente vazias são ignoradas.
 */
import ExcelJS from 'exceljs';
import { cellToRaw, normKey, isBlank } from '../lib/values.js';

export const MAX_ROWS_PER_SHEET = 5000;
// Abas/colunas de apoio que existem no modelo e não são dados.
const IGNORED_SHEETS = new Set(['leia_me', 'leiame', 'readme', 'instrucoes', 'campos', 'listas', 'exemplos', 'exemplo']);
const IGNORED_COLUMNS = new Set(['erros', 'apontamentos', 'avisos']);

const fileIssue = (severity, file, message, hint, sheet = null) => ({ severity, sheet, row: null, column: null, file, message, hint });

function matchEntity(name, entities) {
  const k = normKey(name);
  return entities.find((e) => [e.sheet, ...(e.aliases || [])].map(normKey).includes(k));
}

function matchEntityByFileName(fileName, entities) {
  const base = normKey(fileName.replace(/\.[^.]+$/, ''));
  return entities.find((e) =>
    [e.sheet, ...(e.aliases || [])].map(normKey).some((n) => base === n || base.endsWith(`_${n}`) || base.startsWith(`${n}_`)),
  );
}

function headerKey(raw, entity) {
  const k = normKey(String(raw).replace(/\*/g, ''));
  if (!k) return null;
  const col = entity.columns.find((c) => c.key === k || normKey(c.label) === k);
  return col ? col.key : `?${k}`;
}

/** Cria a estrutura da aba e registra problemas de cabeçalho (colunas obrigatórias faltando/desconhecidas). */
function buildSheet(entity, source, headerCells, dataRows, issues, opts = {}) {
  const headers = headerCells.map((h) => ({ raw: h.raw, key: isBlank(h.raw) ? null : headerKey(h.raw, entity), index: h.index }));
  const present = new Set(headers.map((h) => h.key).filter(Boolean));
  // Sem as colunas-chave não dá para saber qual registro cada linha representa.
  for (const key of entity.keyColumns) {
    if (!present.has(key) && !(key === 'trip_id' && opts.targetTripId)) {
      issues.push(fileIssue('error', source, `A aba ${entity.sheet} não tem a coluna obrigatória "${key}".`, 'Use o modelo oficial: os nomes das colunas precisam ser iguais.', entity.sheet));
    }
  }
  const seen = new Set();
  for (const h of headers) {
    if (!h.key) continue;
    if (h.key.startsWith('?')) {
      if (!IGNORED_COLUMNS.has(h.key.slice(1)))
        issues.push(fileIssue('warning', source, `Coluna desconhecida ignorada na aba ${entity.sheet}: "${h.raw}".`, 'Confira o nome da coluna no modelo.', entity.sheet));
      continue;
    }
    if (seen.has(h.key)) issues.push(fileIssue('error', source, `Coluna repetida na aba ${entity.sheet}: "${h.key}".`, 'Deixe só uma coluna com esse nome.', entity.sheet));
    seen.add(h.key);
  }
  const rows = [];
  for (const { row, values } of dataRows) {
    const cells = {};
    for (const h of headers) {
      if (h.key && !h.key.startsWith('?')) cells[h.key] = values[h.index] ?? '';
    }
    if (Object.values(cells).every(isBlank)) continue;
    rows.push({ row, cells, original: headers.map((h) => values[h.index] ?? '') });
  }
  if (rows.length > MAX_ROWS_PER_SHEET) {
    issues.push(fileIssue('error', source, `A aba ${entity.sheet} tem ${rows.length} linhas; o limite por importação é ${MAX_ROWS_PER_SHEET}.`, 'Divida em mais de um arquivo.', entity.sheet));
  }
  return { source, headers: headers.map((h) => h.raw), headerKeys: headers.map((h) => (h.key && !h.key.startsWith('?') ? h.key : null)), rows };
}

async function readXlsx(file, entities, out, opts) {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(file.buffer);
  } catch {
    out.issues.push(fileIssue('error', file.name, `Não foi possível ler "${file.name}" como planilha Excel.`, 'Salve como .xlsx (Excel 2007 ou mais novo) ou exporte cada aba como CSV.'));
    return;
  }
  for (const ws of wb.worksheets) {
    const entity = matchEntity(ws.name, entities);
    if (!entity) {
      if (!IGNORED_SHEETS.has(normKey(ws.name)))
        out.issues.push(fileIssue('warning', file.name, `Aba "${ws.name}" ignorada: não faz parte do modelo.`, `Abas aceitas: ${entities.map((e) => e.sheet).join(', ')}.`));
      continue;
    }
    if (out.sheets[entity.sheet]) {
      out.issues.push(fileIssue('error', file.name, `A aba ${entity.sheet} foi enviada mais de uma vez.`, 'Envie cada aba uma só vez.', entity.sheet));
      continue;
    }
    let headerCells = null;
    const dataRows = [];
    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const values = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        values[colNumber - 1] = cellToRaw(cell.value);
      });
      if (!headerCells) {
        if (values.some((v) => !isBlank(v))) headerCells = values.map((raw, index) => ({ raw: raw ?? '', index }));
        return;
      }
      dataRows.push({ row: rowNumber, values });
    });
    if (!headerCells) continue; // aba vazia: "importar só as abas preenchidas"
    const sheet = buildSheet(entity, file.name, headerCells, dataRows, out.issues, opts);
    if (sheet.rows.length) out.sheets[entity.sheet] = sheet;
  }
}

function decodeText(buffer) {
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    text = new TextDecoder('windows-1252').decode(buffer); // CSV salvo pelo Excel em português
  }
  return text.replace(/^﻿/, '');
}

/** CSV no padrão RFC 4180, com detecção de separador (; , ou tab). */
export function parseCsv(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  const counts = { ';': 0, ',': 0, '\t': 0 };
  let q = false;
  for (const ch of firstLine) {
    if (ch === '"') q = !q;
    else if (!q && ch in counts) counts[ch]++;
  }
  const sep = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][1] > 0 ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] : ',';
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === sep) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function toCsv(rows, sep = ';') {
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[";\n\r,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + rows.map((r) => r.map(esc).join(sep)).join('\r\n') + '\r\n';
}

function readCsv(file, entities, out, sheetHint, opts) {
  const entity = (sheetHint && matchEntity(sheetHint, entities)) || matchEntityByFileName(file.name, entities);
  if (!entity) {
    out.issues.push(
      fileIssue('error', file.name, `Não sei a qual aba o arquivo "${file.name}" pertence.`, `Nomeie o CSV com o nome da aba (ex.: ${entities[0].sheet}.csv).`),
    );
    return;
  }
  if (out.sheets[entity.sheet]) {
    out.issues.push(fileIssue('error', file.name, `A aba ${entity.sheet} foi enviada mais de uma vez.`, 'Envie cada aba uma só vez.', entity.sheet));
    return;
  }
  const lines = parseCsv(decodeText(file.buffer));
  const headerIdx = lines.findIndex((l) => l.some((v) => !isBlank(v)));
  if (headerIdx < 0) return;
  const headerCells = lines[headerIdx].map((raw, index) => ({ raw, index }));
  const dataRows = lines.slice(headerIdx + 1).map((values, i) => ({ row: headerIdx + 2 + i, values }));
  const sheet = buildSheet(entity, file.name, headerCells, dataRows, out.issues, opts);
  if (sheet.rows.length) out.sheets[entity.sheet] = sheet;
}

/** files: [{ name, buffer }]. sheetHint: nome da aba quando um único CSV não indica no nome do arquivo. */
export async function readSpreadsheets(files, entities, { sheetHint, targetTripId } = {}) {
  const opts = { targetTripId };
  const out = { sheets: {}, issues: [] };
  for (const file of files) {
    const ext = file.name.toLowerCase().split('.').pop();
    if (ext === 'xlsx') await readXlsx(file, entities, out, opts);
    else if (ext === 'csv' || ext === 'txt') readCsv(file, entities, out, files.length === 1 ? sheetHint : null, opts);
    else if (ext === 'xls')
      out.issues.push(fileIssue('error', file.name, 'Formato .xls (Excel 97-2003) não é aceito.', 'Abra no Excel e use "Salvar como" › .xlsx.'));
    else out.issues.push(fileIssue('error', file.name, `Formato não aceito: "${file.name}".`, 'Envie .xlsx ou .csv.'));
  }
  if (!Object.keys(out.sheets).length && !out.issues.some((i) => i.severity === 'error')) {
    out.issues.push(fileIssue('error', null, 'Nenhuma linha de dados encontrada.', 'Preencha ao menos uma aba do modelo abaixo do cabeçalho.'));
  }
  return out;
}
