/**
 * Dados de DEMONSTRAÇÃO, claramente fictícios (PRD §16.9).
 * Só roda com DEMO_MODE=1 e só num banco sem dados reais: tudo aqui é marcado com [DEMO],
 * códigos DEMO-*, e-mails @example.com. Usa o mesmo fluxo de importação da equipe.
 *
 *   DEMO_MODE=1 DATABASE_PATH=data/demo.db ADMIN_EMAILS=voce@vagari.com.br npm run seed:demo
 */
import ExcelJS from 'exceljs';
import { loadConfig } from '../server/config.js';
import { createServices } from '../server/services/index.js';

const config = loadConfig();
if (!config.demoMode) {
  console.error('Recusado: rode com DEMO_MODE=1 (e, de preferência, DATABASE_PATH=data/demo.db).');
  process.exit(1);
}
const services = createServices(config);
const { db } = services;
const realTrips = db.prepare("SELECT COUNT(*) n FROM trips WHERE id NOT LIKE 'DEMO-%'").get().n;
if (realTrips > 0) {
  console.error('Recusado: este banco tem viagens que não são de demonstração. Use outro DATABASE_PATH.');
  process.exit(1);
}

const pdf = (t) => Buffer.from(`%PDF-1.4\n% DOCUMENTO FICTICIO DE DEMONSTRACAO: ${t}\n%%EOF\n`);
async function book(sheets) {
  const wb = new ExcelJS.Workbook();
  for (const [name, rows] of Object.entries(sheets)) {
    const ws = wb.addWorksheet(name);
    rows.forEach((r) => ws.addRow(r));
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const actor = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get()?.id || 'seed-demo';
const day = (offset) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const start = day(45);
const end = day(55);

async function run(kind, sheets, attachments = []) {
  const job = await services.imports.preview({ kind, spreadsheets: [{ name: 'demo.xlsx', buffer: await book(sheets) }], attachments, actorId: actor });
  if (job.preview.errorCount) {
    console.error(JSON.stringify(job.preview, null, 2));
    throw new Error('A carga de demonstração tem erros.');
  }
  return services.imports.confirm(job.id, { actorId: actor });
}

await run('content', {
  DESTINATIONS: [
    ['destination_id', 'country', 'region', 'city', 'timezone', 'parent_id', 'overview'],
    ['demo-italia', 'Itália', '', '', 'Europe/Rome', '', '[DEMO] Destino fictício para demonstração.'],
    ['demo-roma', 'Itália', 'Lácio', 'Roma', 'Europe/Rome', 'demo-italia', '[DEMO] Cidade de demonstração.'],
    ['demo-florenca', 'Itália', 'Toscana', 'Florença', 'Europe/Rome', 'demo-italia', '[DEMO] Cidade de demonstração.'],
  ],
  PLACES: [
    ['content_id', 'destination_id', 'name', 'category', 'short_description', 'address', 'latitude', 'longitude', 'price_level', 'tags', 'source_url', 'last_verified_at'],
    ['demo-roma-mirante', 'demo-roma', '[DEMO] Mirante do Exemplo', 'ponto_turistico', 'Lugar fictício para testar o guia.', 'Rua Fictícia, 1, Roma', '41.89', '12.49', '', 'vista, ao ar livre', 'https://example.org/demo', day(0)],
    ['demo-roma-cantina', 'demo-roma', '[DEMO] Cantina Exemplo', 'restaurante', 'Restaurante fictício.', 'Rua Fictícia, 20, Roma', '41.90', '12.47', '$$', 'massas', 'https://example.org/demo', day(0)],
    ['demo-roma-cafe', 'demo-roma', '[DEMO] Café Exemplo', 'cafe', 'Café fictício.', 'Rua Fictícia, 30, Roma', '41.901', '12.48', '$', 'café', 'https://example.org/demo', day(0)],
    ['demo-flo-museu', 'demo-florenca', '[DEMO] Museu Exemplo', 'museu_cultura', 'Museu fictício.', 'Via Fittizia, 5, Florença', '43.77', '11.25', '', 'arte', 'https://example.org/demo', day(0)],
  ],
});
services.db.prepare("UPDATE places SET status = 'approved', reviewed_by = ?, reviewed_at = ? WHERE id LIKE 'demo-%' AND id != 'demo-flo-museu'").run(actor, new Date().toISOString());

await run(
  'trip',
  {
    TRIPS: [
      ['trip_id', 'trip_name', 'destination_id', 'start_date', 'end_date', 'status', 'trip_type', 'general_notes'],
      ['DEMO-001', '[DEMO] Itália em família', 'demo-italia', start, end, 'published', 'familia', 'Viagem fictícia de demonstração.'],
    ],
    TRAVELERS: [
      ['trip_id', 'traveler_email', 'traveler_name', 'role'],
      ['DEMO-001', 'viajante.demo@example.com', 'Viajante Demo', 'titular'],
      ['DEMO-001', 'crianca.demo@example.com', 'Criança Demo', 'crianca'],
    ],
    FLIGHTS: [
      ['trip_id', 'segment_order', 'airline', 'flight_number', 'departure_airport', 'departure_datetime', 'arrival_airport', 'arrival_datetime', 'booking_reference'],
      ['DEMO-001', '1', '[DEMO] Aérea Exemplo', 'XX 100', 'GRU', `${start} 22:00`, 'FCO', `${day(46)} 14:00`, 'DEMO01'],
      ['DEMO-001', '2', '[DEMO] Aérea Exemplo', 'XX 101', 'FCO', `${end} 10:00`, 'GRU', `${end} 18:00`, 'DEMO01'],
    ],
    ACCOMMODATIONS: [
      ['trip_id', 'accommodation_id', 'city_id', 'property_name', 'checkin_datetime', 'checkout_datetime', 'address', 'latitude', 'longitude'],
      ['DEMO-001', 'hotel-roma', 'demo-roma', '[DEMO] Hotel Exemplo Roma', `${day(46)} 15:00`, `${day(50)} 11:00`, 'Rua Fictícia, 10, Roma', '41.9', '12.49'],
      ['DEMO-001', 'hotel-florenca', 'demo-florenca', '[DEMO] Pousada Exemplo Florença', `${day(50)} 16:00`, `${end} 07:00`, 'Via Fittizia, 2, Florença', '43.77', '11.25'],
    ],
    ITINERARY: [
      ['trip_id', 'item_id', 'date', 'start_time', 'end_time', 'city_id', 'title', 'category', 'address', 'booking_status', 'description'],
      ['DEMO-001', 'transfer-chegada', day(46), '15:00', '16:00', 'demo-roma', '[DEMO] Transfer aeroporto → hotel', 'transfer', 'Aeroporto de Fiumicino', 'confirmado', 'Motorista com placa "Vagari".'],
      ['DEMO-001', 'passeio-centro', day(47), '09:30', '12:30', 'demo-roma', '[DEMO] Passeio guiado pelo centro', 'passeio', 'Rua Fictícia, 1, Roma', 'confirmado', 'Encontro 15 min antes.'],
      ['DEMO-001', 'jantar', day(48), '20:00', '', 'demo-roma', '[DEMO] Jantar na Cantina Exemplo', 'restaurante', 'Rua Fictícia, 20, Roma', 'pendente', ''],
      ['DEMO-001', 'trem', day(50), '10:00', '11:40', 'demo-florenca', '[DEMO] Trem Roma → Florença', 'transporte', 'Estação Exemplo', 'confirmado', ''],
    ],
    DOCUMENTS: [
      ['trip_id', 'document_id', 'category', 'file_name', 'file_url_or_upload_name', 'visible_to_traveler', 'stage'],
      ['DEMO-001', 'voucher-hotel', 'voucher', '[DEMO] Voucher do hotel', 'voucher-hotel.pdf', 'sim', 'destino'],
      ['DEMO-001', 'seguro', 'seguro', '[DEMO] Seguro viagem', 'seguro.pdf', 'sim', 'antes'],
      ['DEMO-001', 'interno', 'outro', '[DEMO] Documento interno', 'interno.pdf', 'não', ''],
    ],
    TASKS: [
      ['trip_id', 'task_id', 'title', 'due_date', 'priority'],
      ['DEMO-001', 'escolha-jantar', '[DEMO] Escolher horário do jantar', day(30), 'media'],
    ],
  },
  [
    { name: 'voucher-hotel.pdf', buffer: pdf('voucher') },
    { name: 'seguro.pdf', buffer: pdf('seguro') },
    { name: 'interno.pdf', buffer: pdf('interno') },
  ],
);
await services.db.prepare("INSERT OR IGNORE INTO trip_places (trip_id, place_id, note, created_at) VALUES ('DEMO-001', 'demo-roma-cantina', '[DEMO] Indicação da Vagari', ?)").run(new Date().toISOString());

console.log('Demonstração criada: viagem DEMO-001. Viajante: viajante.demo@example.com (o código de acesso aparece no log sem SMTP).');
