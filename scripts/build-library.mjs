/** Gera content/biblioteca-inicial.xlsx (abas DESTINATIONS e PLACES) a partir de shared/library.js. */
import ExcelJS from 'exceljs';
import { libraryAsSheets } from '../shared/library.js';

const today = new Date().toISOString().slice(0, 10);
const wb = new ExcelJS.Workbook();
for (const [name, rows] of Object.entries(libraryAsSheets(today))) {
  const ws = wb.addWorksheet(name);
  rows.forEach((r) => ws.addRow(r));
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}
await wb.xlsx.writeFile('content/biblioteca-inicial.xlsx');
console.log('content/biblioteca-inicial.xlsx ok');
