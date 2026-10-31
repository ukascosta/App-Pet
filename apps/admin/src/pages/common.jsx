import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { Badge, Empty, Icon, fmtDateTime } from '../ui.jsx';

export function useData(fn, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const reload = useCallback(() => fn().then(setData, setError), deps);
  useEffect(() => {
    reload();
  }, [reload]);
  return { data, error, reload };
}

const ACTION = { create: ['Criou', 'green'], update: ['Alterou', ''], delete: ['Excluiu', 'red'], invite: ['Convidou', ''], replace_file: ['Nova versão', 'soft-orange'], confirm: ['Importou', 'green'], download: ['Baixou', 'gray'], upsert: ['Indicou', 'soft-orange'] };
const ENTITY = { trip: 'Viagem', trip_traveler: 'Viajante', flight_segment: 'Voo', flight: 'Voo', accommodation: 'Hospedagem', itinerary_item: 'Roteiro', document: 'Documento', task: 'Tarefa', announcement: 'Aviso', place: 'Lugar', destination: 'Destino', import_job: 'Importação', settings: 'Configurações', checklist_rule: 'Regra', user: 'Usuário', trip_place: 'Indicação' };

const show = (v) => (v === null || v === undefined || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));

/** Histórico: quem alterou o quê e quando (antes → depois). */
export function Audit({ tripId }) {
  const { data } = useData(() => api.audit(tripId ? { trip_id: tripId } : {}), [tripId]);
  const entries = data?.entries || [];
  if (!entries.length) return <Empty icon="clock-counter-clockwise" title="Nada no histórico ainda" />;
  return (
    <div className="card">
      <div className="timeline">
        {entries.map((e) => {
          const [label, tone] = ACTION[e.action] || [e.action, 'gray'];
          const keys = Object.keys({ ...(e.before || {}), ...(e.after || {}) }).slice(0, 6);
          return (
            <div key={e.id} className="tl-item">
              <div className="row wrap">
                <Badge tone={tone}>{label}</Badge>
                <b>{ENTITY[e.entity_type] || e.entity_type}</b>
                <span className="muted small mono">{e.entity_id}</span>
                <span className="muted small" style={{ marginLeft: 'auto' }}>
                  <Icon name="user" size={13} /> {e.actor_name || e.actor_email || 'sistema'} · {fmtDateTime(e.created_at)} {e.source === 'import' ? '· via planilha' : ''}
                </span>
              </div>
              {keys.length && e.action !== 'create' ? (
                <div className="small" style={{ marginTop: 4 }}>
                  {keys.map((k) => (
                    <div key={k}>
                      <span className="muted">{k}:</span> <span className="diff-from">{show(e.before?.[k])}</span> → <span className="diff-to">{show(e.after?.[k])}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
