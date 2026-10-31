/**
 * Fluxo de importação (PRD §6.2): upload → validação → prévia → confirmação → histórico.
 * A prévia fica guardada num ImportJob; os anexos ficam numa pasta temporária até a confirmação.
 * Na confirmação o plano é recalculado contra o banco atual (alguém pode ter editado no meio).
 */
import fs from 'node:fs';
import path from 'node:path';
import { newId } from '../lib/ids.js';
import { nowIso } from '../lib/time.js';
import { audit } from '../lib/audit.js';
import { sheetsFor, ALL_ENTITIES } from '../domain/entities.js';
import { readSpreadsheets } from '../import/workbook.js';
import { buildContext, planImport, planNormalized, applyPlan } from '../import/engine.js';
import { serializeCell } from '../import/templates.js';
import { sha256Buffer } from './storage.js';
import { applyEffects } from '../domain/effects.js';

const ENTITIES_BY_SHEET = Object.fromEntries(ALL_ENTITIES.map((e) => [e.sheet, e]));
const JOB_TTL_MS = 24 * 3_600_000;

export class ImportError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Prévia enxuta para a tela (sem os valores internos). */
function publicPreview(plan, fileIssues) {
  return {
    fileIssues,
    sheets: plan.sheets.map((s) => ({
      sheet: s.sheet,
      label: s.label,
      counts: s.counts,
      rows: s.rows.map((r) => ({ row: r.row, label: r.label, action: r.action, changes: r.changes, issues: r.issues })),
    })),
    errorCount: plan.errorCount + fileIssues.filter((i) => i.severity === 'error').length,
    warningCount: plan.warningCount + fileIssues.filter((i) => i.severity === 'warning').length,
  };
}

export function createImports(services) {
  const { db, config, storage, settings, log = console } = services;
  const now = services.now || (() => Date.now());
  const tmpRoot = path.resolve(config.tmpDir, 'imports');

  const loadAttachments = (job) =>
    JSON.parse(job.attachments).map((a) => ({ ...a, read: () => fs.readFileSync(a.path) }));

  function getJob(id) {
    const job = db.prepare('SELECT * FROM import_jobs WHERE id = ?').get(id);
    if (!job) return null;
    return job;
  }

  function view(job) {
    return {
      id: job.id,
      kind: job.kind,
      status: job.status,
      file_names: JSON.parse(job.file_names),
      target_trip_id: job.target_trip_id,
      uploaded_by: job.uploaded_by,
      attachments: JSON.parse(job.attachments).map((a) => ({ name: a.name, size: a.size })),
      preview: job.preview ? JSON.parse(job.preview) : null,
      summary: job.summary ? JSON.parse(job.summary) : null,
      error_count: job.error_count,
      warning_count: job.warning_count,
      created_at: job.created_at,
      completed_at: job.completed_at,
    };
  }

  function cleanup(jobId) {
    fs.rmSync(path.join(tmpRoot, jobId), { recursive: true, force: true });
  }

  return {
    getJob,
    view,

    list({ kind, limit = 50 } = {}) {
      const rows = kind
        ? db.prepare('SELECT * FROM import_jobs WHERE kind = ? ORDER BY created_at DESC LIMIT ?').all(kind, limit)
        : db.prepare('SELECT * FROM import_jobs ORDER BY created_at DESC LIMIT ?').all(limit);
      return rows.map((j) => {
        const v = view(j);
        delete v.preview;
        return v;
      });
    },

    /**
     * spreadsheets / attachments: [{ name, buffer }].
     * targetTripId: importar para uma viagem existente (linhas sem trip_id herdam esse código).
     */
    async preview({ kind, spreadsheets, attachments = [], targetTripId = null, sheetHint = null, actorId }) {
      if (!['trip', 'content'].includes(kind)) throw new ImportError('Tipo de importação inválido (use trip ou content).');
      if (!spreadsheets?.length) throw new ImportError('Envie ao menos uma planilha (.xlsx ou .csv).');
      if (targetTripId) {
        if (kind !== 'trip') throw new ImportError('Viagem de destino só vale para importação de viagem.');
        if (!db.prepare('SELECT 1 FROM trips WHERE id = ?').get(targetTripId)) throw new ImportError('A viagem escolhida não existe.', 404);
      }
      const entities = sheetsFor(kind);
      const read = await readSpreadsheets(spreadsheets, entities, { sheetHint, targetTripId });

      const jobId = newId('imp_');
      const dir = path.join(tmpRoot, jobId);
      const seenNames = new Set();
      const savedAttachments = [];
      const fileIssues = [...read.issues];
      if (attachments.length) fs.mkdirSync(dir, { recursive: true });
      attachments.forEach((a, i) => {
        const lower = a.name.toLowerCase();
        if (seenNames.has(lower)) {
          fileIssues.push({ severity: 'error', sheet: null, row: null, column: null, file: a.name, message: `Dois anexos com o mesmo nome: "${a.name}".`, hint: 'Renomeie um deles.' });
          return;
        }
        seenNames.add(lower);
        const p = path.join(dir, `a${i}`);
        fs.writeFileSync(p, a.buffer, { mode: 0o600 });
        savedAttachments.push({ name: a.name, path: p, size: a.buffer.length, sha256: sha256Buffer(a.buffer) });
      });

      const ctx = buildContext(db, {
        settings: settings.all(),
        targetTripId,
        attachments: savedAttachments.map((a) => ({ ...a, read: () => fs.readFileSync(a.path) })),
        storage,
        actorId,
        now: now(),
      });
      const plan = planImport(db, entities, read.sheets, ctx);
      const preview = publicPreview(plan, fileIssues);

      // Anexos que nenhuma linha usa: provavelmente nome digitado errado.
      const used = new Set();
      for (const s of plan.sheets)
        for (const r of s.rows) for (const k of ['file_url_or_upload_name', 'image_url_or_upload_name']) if (r.values[k]) used.add(String(r.values[k]).toLowerCase());
      for (const a of savedAttachments)
        if (!used.has(a.name.toLowerCase()))
          preview.fileIssues.push({ severity: 'warning', sheet: null, row: null, column: null, file: a.name, message: `O anexo "${a.name}" não é citado em nenhuma linha.`, hint: 'Confira o nome do arquivo na planilha.' }),
            preview.warningCount++;

      const parsed = {
        normalized: plan.sheets.map((s) => ({ sheet: s.sheet, rows: s.rows.map((r) => ({ row: r.row, values: r.values, normIssues: r.normIssues })) })),
        original: Object.fromEntries(
          Object.entries(read.sheets).map(([sheet, d]) => [
            sheet,
            { headers: d.headers.map(serializeCell), headerKeys: d.headerKeys, rows: d.rows.map((r) => ({ row: r.row, original: r.original.map(serializeCell) })) },
          ]),
        ),
      };

      db.prepare(
        `INSERT INTO import_jobs (id, kind, file_names, uploaded_by, target_trip_id, status, parsed, attachments, preview, error_count, warning_count, created_at)
         VALUES (?, ?, ?, ?, ?, 'preview', ?, ?, ?, ?, ?, ?)`,
      ).run(
        jobId,
        kind,
        JSON.stringify(spreadsheets.map((s) => s.name)),
        actorId,
        targetTripId,
        JSON.stringify(parsed),
        JSON.stringify(savedAttachments),
        JSON.stringify(preview),
        preview.errorCount,
        preview.warningCount,
        nowIso(now()),
      );
      return view(getJob(jobId));
    },

    /** Grava de fato. Recalcula o plano; se surgirem erros, nada é gravado e a prévia é atualizada. */
    confirm(jobId, { actorId, notify = false }) {
      const job = getJob(jobId);
      if (!job) throw new ImportError('Importação não encontrada.', 404);
      if (job.status !== 'preview') throw new ImportError(`Esta importação já está "${job.status}".`, 409);
      if (now() - Date.parse(job.created_at) > JOB_TTL_MS) {
        db.prepare("UPDATE import_jobs SET status = 'canceled', completed_at = ? WHERE id = ?").run(nowIso(now()), jobId);
        cleanup(jobId);
        throw new ImportError('A prévia expirou (mais de 24 h). Envie a planilha de novo.', 410);
      }
      const preview = JSON.parse(job.preview);
      if (preview.fileIssues.some((i) => i.severity === 'error')) throw new ImportError('Corrija os erros do arquivo antes de confirmar.', 422);

      const parsed = JSON.parse(job.parsed);
      const ctx = buildContext(db, {
        settings: settings.all(),
        targetTripId: job.target_trip_id,
        attachments: loadAttachments(job),
        storage,
        actorId,
        now: now(),
      });
      const normalized = parsed.normalized.map((s) => ({ entity: ENTITIES_BY_SHEET[s.sheet], rows: s.rows }));
      const plan = planNormalized(db, normalized, ctx);
      if (plan.errorCount > 0) {
        const fresh = publicPreview(plan, preview.fileIssues);
        db.prepare('UPDATE import_jobs SET preview = ? WHERE id = ?').run(JSON.stringify(fresh), jobId);
        const err = new ImportError('Os dados mudaram desde a prévia e agora há erros. Revise a prévia atualizada.', 409);
        err.preview = fresh;
        throw err;
      }
      const started = now();
      let results;
      try {
        results = applyPlan(db, ENTITIES_BY_SHEET, plan, ctx);
      } catch (e) {
        log.error?.(`Importação ${jobId} falhou: ${e.stack || e.message}`);
        db.prepare("UPDATE import_jobs SET status = 'failed', summary = ?, completed_at = ? WHERE id = ?").run(
          JSON.stringify({ error: 'Falha ao gravar; nada foi alterado.' }),
          nowIso(now()),
          jobId,
        );
        cleanup(jobId);
        throw new ImportError('Falha ao gravar a importação; nenhum dado foi alterado.', 500);
      }
      const effects = applyEffects(services, results, { notify });
      const summary = {
        sheets: plan.sheets.map((s) => ({ sheet: s.sheet, label: s.label, ...s.counts })),
        trips: effects.trips,
        notified: effects.notified,
        apply_ms: now() - started,
      };
      db.prepare("UPDATE import_jobs SET status = 'completed', summary = ?, completed_at = ?, parsed = NULL WHERE id = ?").run(
        JSON.stringify(summary),
        nowIso(now()),
        jobId,
      );
      audit(db, { actorId, entityType: 'import_job', entityId: jobId, action: 'confirm', after: summary, source: 'import' });
      cleanup(jobId);
      return view(getJob(jobId));
    },

    cancel(jobId, { actorId }) {
      const job = getJob(jobId);
      if (!job) throw new ImportError('Importação não encontrada.', 404);
      if (job.status !== 'preview') throw new ImportError(`Esta importação já está "${job.status}".`, 409);
      db.prepare("UPDATE import_jobs SET status = 'canceled', completed_at = ?, parsed = NULL WHERE id = ?").run(nowIso(now()), jobId);
      audit(db, { actorId, entityType: 'import_job', entityId: jobId, action: 'cancel', source: 'import' });
      cleanup(jobId);
      return view(getJob(jobId));
    },

    /** Prévias abandonadas há mais de 24 h: libera disco. */
    expireOld() {
      const cutoff = nowIso(now() - JOB_TTL_MS);
      const old = db.prepare("SELECT id FROM import_jobs WHERE status = 'preview' AND created_at < ?").all(cutoff);
      for (const { id } of old) {
        db.prepare("UPDATE import_jobs SET status = 'canceled', completed_at = ?, parsed = NULL WHERE id = ?").run(nowIso(now()), id);
        cleanup(id);
      }
      return old.length;
    },

    parsedOf(job) {
      return job.parsed ? JSON.parse(job.parsed) : null;
    },
  };
}
