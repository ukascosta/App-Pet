import { Router } from 'express';
import { formatWhatsApp, whatsAppLink } from '../lib/phone.js';
import { HttpError, oneOf, text } from '../lib/validate.js';
import { storeAuth } from '../middleware.js';
import { storeGreeting } from '../services/messages.js';

const STATUSES = ['new', 'contacted', 'sold', 'closed'];

export function storeRoutes({ db, config, whatsapp, now }) {
  const router = Router();
  router.use(storeAuth(config));

  const deliveryFor = db.prepare(
    "SELECT status, last_error, attempts FROM outbox WHERE lead_id = ? AND channel = 'store_whatsapp' ORDER BY id DESC LIMIT 1",
  );

  const serialize = (row) => {
    const delivery = deliveryFor.get(row.id);
    return {
      id: row.id,
      kind: row.kind,
      status: row.status,
      note: row.note,
      daysLeft: Math.round(row.days_left * 10) / 10,
      suggestedKg: row.suggested_kg,
      createdAt: new Date(row.created_at).toISOString(),
      customer: { name: row.customer_name, email: row.customer_email, whatsapp: formatWhatsApp(row.customer_whatsapp) },
      pet: { name: row.pet_name, breed: row.breed_name, color: row.color, species: row.species },
      whatsappLink: whatsAppLink(
        row.customer_whatsapp,
        storeGreeting({ customerName: row.customer_name, petName: row.pet_name, storeName: config.store.name }),
      ),
      // Se o aviso automático por WhatsApp falhou, o painel mostra para a loja agir manualmente.
      delivery: delivery ? { status: delivery.status, error: delivery.last_error } : null,
    };
  };

  const SELECT = `
    SELECT l.*, c.name AS customer_name, c.email AS customer_email, c.whatsapp AS customer_whatsapp,
           p.name AS pet_name, p.breed_name, p.color, p.species
    FROM leads l
    JOIN customers c ON c.id = l.customer_id
    JOIN pets p ON p.id = l.pet_id`;

  router.get('/leads', (req, res) => {
    const filter = String(req.query.status ?? 'open');
    const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    for (const { status, n } of db.prepare('SELECT status, COUNT(*) n FROM leads GROUP BY status').all()) counts[status] = n;

    let rows;
    if (filter === 'open') {
      rows = db.prepare(`${SELECT} WHERE l.status IN ('new','contacted') ORDER BY (l.kind = 'empty') DESC, l.created_at DESC`).all();
    } else if (STATUSES.includes(filter)) {
      rows = db.prepare(`${SELECT} WHERE l.status = ? ORDER BY l.updated_at DESC LIMIT 100`).all(filter);
    } else {
      throw new HttpError(400, 'Filtro inválido.');
    }
    res.json({ store: { name: config.store.name }, counts: { ...counts, open: counts.new + counts.contacted }, leads: rows.map(serialize) });
  });

  router.patch('/leads/:id', (req, res) => {
    const lead = db.prepare('SELECT id FROM leads WHERE id = ?').get(Number(req.params.id));
    if (!lead) throw new HttpError(404, 'Pedido não encontrado.');

    const b = req.body ?? {};
    const status = b.status === undefined ? undefined : oneOf(b.status, 'status', STATUSES, 'o status');
    const note = b.note === undefined ? undefined : text(b.note, 'note', 'a anotação', { min: 0, max: 300 });

    db.prepare('UPDATE leads SET status = COALESCE(?, status), note = COALESCE(?, note), updated_at = ? WHERE id = ?').run(
      status ?? null,
      note ?? null,
      now(),
      lead.id,
    );
    res.json({ lead: serialize(db.prepare(`${SELECT} WHERE l.id = ?`).get(lead.id)) });
  });

  // Botão "enviar mensagem de teste" do painel: confere se o WhatsApp da loja está configurado.
  router.post('/test-whatsapp', async (_req, res) => {
    if (!config.store.whatsapp) throw new HttpError(400, 'Defina STORE_WHATSAPP no servidor primeiro.');
    try {
      await whatsapp.send({
        to: config.store.whatsapp,
        text: `✅ Teste do PetLee: o aviso de ração acabando chegará neste número (${config.store.name}).`,
        data: { customerName: 'Teste', customerWhatsapp: config.store.whatsapp, petName: 'Teste', daysLabel: '0', kind: 'test', suggestedKg: 0 },
      });
    } catch (err) {
      throw new HttpError(502, `O provedor de WhatsApp recusou o envio: ${err.message}`);
    }
    res.json({ ok: true, provider: whatsapp.name });
  });

  return router;
}
