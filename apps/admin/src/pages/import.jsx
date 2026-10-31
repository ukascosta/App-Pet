/** Importação em lote: escolher tipo → enviar → prévia com erros por linha/coluna → confirmar. */
import React, { useState } from 'react';
import { api } from '../api.js';
import { Badge, Btn, Empty, HowTo, Icon, Impact, Toggle, fmtDateTime, useToast } from '../ui.jsx';
import { useData } from './common.jsx';

const ACTION = { create: ['Criar', 'green'], update: ['Atualizar', ''], unchanged: ['Sem mudança', 'gray'], error: ['Erro', 'red'] };

export function ImportPage() {
  const toast = useToast();
  const [kind, setKind] = useState('trip');
  const [sheets, setSheets] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [job, setJob] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notify, setNotify] = useState(false);
  const [onlyIssues, setOnlyIssues] = useState(false);
  const history = useData(() => api.imports(), [job?.status]);

  const send = async (clean) => {
    setBusy(true);
    try {
      const f = new FormData();
      f.append('kind', kind);
      for (const s of sheets) f.append('spreadsheets', s);
      for (const a of attachments) f.append('attachments', a);
      if (clean) f.append('demo_clean', '1');
      const r = await api.previewImport(f);
      setJob(r.import);
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };
  const confirm = async () => {
    setBusy(true);
    try {
      const r = await api.confirmImport(job.id, notify);
      setJob(r.import);
      toast('Importação concluída ✅');
    } catch (e) {
      if (e.preview) setJob({ ...job, preview: e.preview });
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };
  const pv = job?.preview;
  const download = (url) => (url ? (window.location.href = url) : toast('Na prévia o download fica desligado'));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Importar planilha</h1>
          <p>Carga em lote de viagens ou de conteúdo (destinos e lugares). Nada é gravado antes de você conferir a prévia e confirmar.</p>
        </div>
        <div className="row">
          <Btn variant="secondary" icon="download-simple" onClick={() => download(api.templateUrl('viagem'))}>Modelo de viagem</Btn>
          <Btn variant="secondary" icon="download-simple" onClick={() => download(api.templateUrl('conteudo'))}>Modelo de conteúdo</Btn>
        </div>
      </div>
      <HowTo
        open={!job}
        steps={[
          'Baixe o modelo oficial e preencha só as abas que precisar (abas vazias são ignoradas). A aba CAMPOS explica cada coluna.',
          'Códigos fixos (trip_id, destination_id, content_id) ATUALIZAM o que já existe em vez de duplicar. Nada é apagado por faltar na planilha.',
          'Célula vazia mantém o valor atual. Para apagar um campo, escreva [limpar].',
          'Documentos e fotos: anexe os arquivos aqui com o mesmo nome escrito na planilha.',
          'Confira a prévia. Erros bloqueiam; avisos não. Baixe o relatório ou a planilha com apontamentos, corrija e envie de novo.',
        ]}
      />

      {!job || job.status !== 'preview' ? (
        <div className="card">
          <div className="grid g2">
            {[
              ['trip', 'Viagens', 'suitcase-rolling', 'Viagens, viajantes, voos, hospedagens, roteiro, documentos e tarefas.'],
              ['content', 'Conteúdo', 'compass', 'Destinos, lugares e imagens. Tudo entra como "pendente de revisão".'],
            ].map(([k, l, i, d]) => (
              <button key={k} onClick={() => setKind(k)} className="card flat" style={{ textAlign: 'left', cursor: 'pointer', borderColor: kind === k ? 'var(--purple500)' : undefined, borderWidth: 2, background: kind === k ? 'var(--purple50)' : '#fff' }}>
                <Icon name={i} size={30} weight="duotone" color="var(--purple600)" />
                <h3 style={{ marginTop: 8 }}>{l}</h3>
                <p className="small muted">{d}</p>
              </button>
            ))}
          </div>
          <div className="grid g2" style={{ marginTop: 16 }}>
            <Drop label="Planilha(s) .xlsx ou .csv" icon="file-xls" accept=".xlsx,.csv" files={sheets} onFiles={setSheets} />
            <Drop label="Anexos (PDF, JPG, PNG…) — opcional" icon="files" accept=".pdf,.png,.jpg,.jpeg,.webp" files={attachments} onFiles={setAttachments} />
          </div>
          <div className="row" style={{ marginTop: 16, justifyContent: 'space-between' }}>
            <span className="small muted">{api.demo ? 'Na prévia, qualquer arquivo gera uma simulação de importação.' : ''}</span>
            <Btn icon="eye" disabled={busy || (!sheets.length && !api.demo)} onClick={() => send(false)}>
              {busy ? 'Lendo a planilha…' : 'Ver prévia'}
            </Btn>
          </div>
          {job?.status === 'completed' ? (
            <div className="impact" style={{ marginTop: 16, background: 'var(--success-bg)' }}>
              <Icon name="check-circle" weight="fill" color="var(--success)" />
              <div><b>Importação concluída.</b> {job.summary?.sheets?.map((s) => `${s.label}: ${s.create} novos, ${s.update} atualizados`).join(' · ')}{job.summary?.notified ? ` · ${job.summary.notified} viajante(s) avisados` : ''}</div>
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <div className="grid g4">
            {[
              ['Novos', pv.sheets.reduce((s, x) => s + x.counts.create, 0), 'plus-circle', 'var(--success)'],
              ['Atualizações', pv.sheets.reduce((s, x) => s + x.counts.update, 0), 'arrows-clockwise', 'var(--purple600)'],
              ['Erros', pv.errorCount, 'x-circle', 'var(--danger)'],
              ['Avisos', pv.warningCount, 'warning', 'var(--warning)'],
            ].map(([l, v, i, c]) => (
              <div key={l} className="card kpi">
                <div className="row"><Icon name={i} weight="duotone" color={c} size={22} /><span className="label">{l}</span></div>
                <div className="value" style={{ color: c }}>{v}</div>
              </div>
            ))}
          </div>
          {pv.errorCount ? (
            <div className="impact" style={{ background: 'var(--danger-bg)', marginTop: 16 }}>
              <Icon name="warning-circle" weight="fill" color="var(--danger)" size={22} />
              <div style={{ flex: 1 }}>
                <b>Tem {pv.errorCount} erro(s) — nada foi gravado.</b> Corrija na planilha e envie de novo. Dica: a planilha com apontamentos marca as células com problema.
                <div className="row wrap" style={{ marginTop: 10 }}>
                  <Btn sm variant="secondary" icon="file-csv" onClick={() => download(api.errorsUrl(job.id))}>Relatório de erros (CSV)</Btn>
                  <Btn sm variant="secondary" icon="file-xls" onClick={() => download(api.annotatedUrl(job.id))}>Planilha com apontamentos</Btn>
                  {api.demo ? <Btn sm icon="upload-simple" onClick={() => send(true)}>Simular envio da versão corrigida</Btn> : null}
                </div>
              </div>
            </div>
          ) : null}
          <div className="row" style={{ margin: '18px 0 8px', justifyContent: 'space-between' }}>
            <label className="row small"><Toggle on={onlyIssues} onChange={setOnlyIssues} label="Só com problemas" /> Mostrar só linhas com erro ou aviso</label>
            <span className="small muted">{job.file_names?.join(', ')}</span>
          </div>
          {pv.sheets.map((s) => (
            <div key={s.sheet} className="card" style={{ marginBottom: 14 }}>
              <div className="card-title">
                <h2>{s.label} <span className="muted small mono">{s.sheet}</span></h2>
                <div className="row">
                  {s.counts.create ? <Badge tone="green">{s.counts.create} novo(s)</Badge> : null}
                  {s.counts.update ? <Badge>{s.counts.update} atualização(ões)</Badge> : null}
                  {s.counts.unchanged ? <Badge tone="gray">{s.counts.unchanged} sem mudança</Badge> : null}
                  {s.counts.error ? <Badge tone="red">{s.counts.error} com erro</Badge> : null}
                </div>
              </div>
              <table className="table">
                <thead><tr><th style={{ width: 60 }}>Linha</th><th>Registro</th><th style={{ width: 120 }}>Ação</th><th>Detalhes</th></tr></thead>
                <tbody>
                  {s.rows.filter((r) => !onlyIssues || r.issues.length).map((r) => (
                    <tr key={r.row}>
                      <td className="mono">{r.row}</td>
                      <td className="strong">{r.label}</td>
                      <td><Badge tone={ACTION[r.action][1]}>{ACTION[r.action][0]}</Badge></td>
                      <td className="small">
                        {Object.entries(r.changes || {}).map(([k, c]) => (
                          <div key={k}><span className="muted">{k}:</span> <span className="diff-from">{String(c.from ?? '—')}</span> → <span className="diff-to">{String(c.to ?? '—')}</span></div>
                        ))}
                        {r.issues.map((i, k) => (
                          <div key={k} style={{ color: i.severity === 'error' ? 'var(--danger)' : 'var(--warning)', marginTop: 2 }}>
                            <b>{i.severity === 'error' ? 'Erro' : 'Aviso'}{i.column ? ` [${i.column}]` : ''}:</b> {i.message}
                            {i.hint ? <div className="muted">→ {i.hint}</div> : null}
                          </div>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          <div className="card row wrap" style={{ position: 'sticky', bottom: 16, justifyContent: 'space-between' }}>
            <label className="row"><Toggle on={notify} onChange={setNotify} label="Avisar viajantes" /> <span><b>Avisar viajantes</b> <span className="small muted">das mudanças de roteiro (documentos novos sempre avisam)</span></span></label>
            <div className="row">
              <Btn variant="ghost" onClick={async () => { await api.cancelImport(job.id); setJob(null); }}>Cancelar</Btn>
              <Btn variant="accent" icon="check-circle" disabled={busy || pv.errorCount > 0} onClick={confirm}>Confirmar importação</Btn>
            </div>
          </div>
        </>
      )}

      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-title"><h2>Importações recentes</h2></div>
        {(history.data?.imports || []).length ? (
          <table className="table">
            <thead><tr><th>Quando</th><th>Tipo</th><th>Arquivo</th><th>Situação</th><th>Erros na 1ª prévia</th></tr></thead>
            <tbody>
              {history.data.imports.map((j) => (
                <tr key={j.id}>
                  <td>{fmtDateTime(j.created_at)}</td>
                  <td>{j.kind === 'trip' ? 'Viagem' : 'Conteúdo'}</td>
                  <td className="small">{(j.file_names || []).join(', ')}</td>
                  <td><Badge tone={{ completed: 'green', preview: 'yellow', canceled: 'gray', failed: 'red' }[j.status]}>{{ completed: 'Concluída', preview: 'Em prévia', canceled: 'Cancelada', failed: 'Falhou' }[j.status]}</Badge></td>
                  <td>{j.error_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <Empty icon="file-xls" title="Nenhuma importação ainda" />}
      </div>
      <div style={{ marginTop: 16 }}>
        <Impact where="tudo">Depois de confirmada, a importação atualiza o app na hora: viagens publicadas aparecem para os viajantes e documentos novos visíveis geram notificação.</Impact>
      </div>
    </>
  );
}

function Drop({ label, icon, accept, files, onFiles }) {
  const [over, setOver] = useState(false);
  const pick = () => {
    const i = document.createElement('input');
    i.type = 'file';
    i.multiple = true;
    i.accept = accept;
    i.onchange = () => onFiles([...files, ...i.files]);
    i.click();
  };
  return (
    <div
      className={`dropzone ${over ? 'over' : ''}`}
      onClick={pick}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); onFiles([...files, ...e.dataTransfer.files]); }}
      role="button"
      tabIndex={0}
    >
      <Icon name={icon} size={36} weight="duotone" color="var(--purple500)" />
      <div className="strong" style={{ marginTop: 6 }}>{label}</div>
      <div className="small muted">Arraste aqui ou clique para escolher</div>
      {files.length ? (
        <div className="row wrap" style={{ justifyContent: 'center', marginTop: 10 }} onClick={(e) => e.stopPropagation()}>
          {files.map((f, i) => (
            <span key={i} className="badge">{f.name} <button className="icon-btn" style={{ width: 18, height: 18 }} aria-label="Remover" onClick={() => onFiles(files.filter((_, k) => k !== i))}><Icon name="x" size={12} /></button></span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
