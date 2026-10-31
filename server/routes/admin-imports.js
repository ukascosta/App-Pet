/**
 * Importação em lote e modelos para download (PRD §6).
 * Viagens: só administradores. Conteúdo: administradores e editores.
 */
import { Router } from 'express';
import { HttpError, requireStaff, uploader, uploadedName, sendFile } from '../http.js';
import { buildTemplateXlsx, buildTemplateCsv, buildErrorReportCsv, buildAnnotatedXlsx } from '../import/templates.js';
import { ImportError } from '../services/imports.js';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function assertKindAllowed(user, kind) {
  if (kind === 'trip' && user.role !== 'admin') throw new HttpError(403, 'Só administradores importam viagens.');
}

export function adminImportRoutes(services) {
  const { imports, settings, config } = services;
  const r = Router();
  r.use(requireStaff);
  const upload = uploader(config);

  const loadJob = (req) => {
    const job = imports.getJob(req.params.id);
    if (!job) throw new HttpError(404, 'Importação não encontrada.');
    assertKindAllowed(req.user, job.kind);
    return job;
  };

  const wrap = (fn) => async (req, res) => {
    try {
      await fn(req, res);
    } catch (e) {
      if (e instanceof ImportError) throw new HttpError(e.status, e.message, e.preview ? { preview: e.preview } : {});
      throw e;
    }
  };

  r.get('/templates/:kind.xlsx', async (req, res) => {
    const kind = req.params.kind === 'conteudo' || req.params.kind === 'content' ? 'content' : req.params.kind === 'viagem' || req.params.kind === 'trip' ? 'trip' : null;
    if (!kind) throw new HttpError(404, 'Modelo não encontrado. Use viagem ou conteudo.');
    const buffer = await buildTemplateXlsx(kind, settings.all());
    sendFile(res, { buffer, fileName: `vagari-modelo-${kind === 'trip' ? 'viagem' : 'conteudo'}.xlsx`, mime: XLSX, inline: false });
  });

  r.get('/templates/csv/:sheet.csv', (req, res) => {
    const csv = buildTemplateCsv(String(req.params.sheet).toUpperCase());
    if (!csv) throw new HttpError(404, 'Aba desconhecida.');
    sendFile(res, { buffer: Buffer.from(csv), fileName: `${req.params.sheet.toUpperCase()}.csv`, mime: 'text/csv; charset=utf-8', inline: false });
  });

  r.get('/imports', (req, res) => {
    const kind = req.user.role === 'admin' ? req.query.kind : 'content';
    res.json({ imports: imports.list({ kind }) });
  });

  /**
   * multipart/form-data:
   *   kind=trip|content, trip_id (opcional), sheet (opcional, para um CSV sem nome de aba)
   *   spreadsheets: um ou mais .xlsx/.csv
   *   attachments: PDFs/imagens citados nas planilhas
   */
  r.post(
    '/imports',
    upload.fields([
      { name: 'spreadsheets', maxCount: 10 },
      { name: 'attachments', maxCount: 50 },
    ]),
    wrap(async (req, res) => {
      const kind = req.body?.kind;
      assertKindAllowed(req.user, kind);
      const files = (name) => (req.files?.[name] || []).map((f) => ({ name: uploadedName(f), buffer: f.buffer }));
      const job = await imports.preview({
        kind,
        spreadsheets: files('spreadsheets'),
        attachments: files('attachments'),
        targetTripId: req.body?.trip_id || null,
        sheetHint: req.body?.sheet || null,
        actorId: req.user.id,
      });
      res.status(201).json({ import: job });
    }),
  );

  r.get('/imports/:id', (req, res) => res.json({ import: imports.view(loadJob(req)) }));

  r.post(
    '/imports/:id/confirm',
    wrap((req, res) => {
      loadJob(req);
      res.json({ import: imports.confirm(req.params.id, { actorId: req.user.id, notify: !!req.body?.notify }) });
    }),
  );

  r.post(
    '/imports/:id/cancel',
    wrap((req, res) => {
      loadJob(req);
      res.json({ import: imports.cancel(req.params.id, { actorId: req.user.id }) });
    }),
  );

  r.get('/imports/:id/errors.csv', (req, res) => {
    const job = imports.view(loadJob(req));
    sendFile(res, { buffer: Buffer.from(buildErrorReportCsv(job)), fileName: `erros-${job.id}.csv`, mime: 'text/csv; charset=utf-8', inline: false });
  });

  /** Planilha enviada + coluna ERROS e células destacadas, para corrigir e reenviar. */
  r.get('/imports/:id/annotated.xlsx', async (req, res) => {
    const raw = loadJob(req);
    const parsed = imports.parsedOf(raw);
    if (!parsed) throw new HttpError(410, 'A planilha original não está mais disponível (importação concluída ou cancelada).');
    const buffer = await buildAnnotatedXlsx(imports.view(raw), parsed);
    sendFile(res, { buffer, fileName: `apontamentos-${raw.id}.xlsx`, mime: XLSX, inline: false });
  });

  return r;
}
