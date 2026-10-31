/** Viagens: lista, nova viagem e detalhe com abas (viajantes, voos, hospedagens, roteiro, docs, tarefas, avisos, destaques, histórico). */
import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { FormDrawer } from '../form.jsx';
import { Avatar, Badge, Btn, Cover, Empty, HowTo, Icon, Impact, ImpactTag, StatusBadge, Toggle, fmtDate, fmtDateTime, useToast } from '../ui.jsx';
import { DESTINATIONS, destinationName } from '@shared/library.js';
import { useData, Audit } from './common.jsx';

const destOptions = DESTINATIONS.map((d) => ({ key: d.id, label: `${destinationName(d)}${d.city ? ` (${d.country})` : ''}` }));
const art = (id) => DESTINATIONS.find((d) => d.id === id)?.art;

export function TripsPage({ go }) {
  const [filter, setFilter] = useState('');
  const [q, setQ] = useState('');
  const { data, reload } = useData(() => api.trips(Object.fromEntries(Object.entries({ status: filter, q }).filter(([, v]) => v))), [filter, q]);
  const [creating, setCreating] = useState(false);
  const toast = useToast();
  const trips = data?.trips || [];
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Viagens</h1>
          <p>Tudo que o viajante vê no app vem daqui. Monte a viagem, confira as pendências e publique.</p>
        </div>
        <div className="row">
          <Btn variant="secondary" icon="file-xls" onClick={() => go('importar')}>
            Importar planilha
          </Btn>
          <Btn icon="plus-circle" onClick={() => setCreating(true)}>
            Nova viagem
          </Btn>
        </div>
      </div>
      <HowTo
        steps={[
          'Crie a viagem (fica em Rascunho, invisível para o cliente) ou importe tudo de uma vez por planilha.',
          'Abra a viagem e preencha viajantes, voos, hospedagens, roteiro e documentos. O selo "Faltam…" mostra o que ainda falta.',
          'Quando estiver pronta, clique em Publicar e envie o convite para cada viajante.',
          'Mudou algo depois? Edite normalmente. Se for importante, marque "Avisar viajantes" ao salvar.',
        ]}
      />
      <div className="row wrap" style={{ marginBottom: 16 }}>
        <input className="input" style={{ maxWidth: 340 }} placeholder="Buscar por código, nome ou viajante…" value={q} onChange={(e) => setQ(e.target.value)} />
        {[['', 'Todas'], ['draft', 'Rascunho'], ['published', 'Publicadas'], ['archived', 'Arquivadas']].map(([k, l]) => (
          <button key={k} className={`btn sm ${filter === k ? '' : 'outline'}`} onClick={() => setFilter(k)}>
            {l}
          </button>
        ))}
      </div>
      <div className="grid g3">
        {trips.map((t) => (
          <div key={t.id} className="card" style={{ padding: 0, cursor: 'pointer', overflow: 'hidden' }} onClick={() => go(`viagem-${t.id}`)}>
            <Cover art={art(t.destination_id)} height={130} style={{ borderRadius: 0 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="small" style={{ opacity: 0.9, fontWeight: 700 }}>{t.id}</span>
                <StatusBadge status={t.status} />
              </div>
              <h2 style={{ marginTop: 4 }}>{t.name}</h2>
            </Cover>
            <div style={{ padding: 16, display: 'grid', gap: 8 }}>
              <div className="row small muted">
                <Icon name="calendar" /> {fmtDate(t.start_date)} → {fmtDate(t.end_date)} · <Icon name="map-pin-simple" /> {t.city}
              </div>
              <div className="row small muted">
                <Icon name="users" /> {t.summary.travelers} viajante(s) · {t.summary.accepted} no app
              </div>
              {t.summary.essential_complete ? (
                <Badge tone="green" icon="check-circle">Dados essenciais completos</Badge>
              ) : (
                <Badge tone="yellow" icon="warning">Faltam: {t.summary.missing.join(', ')}</Badge>
              )}
            </div>
          </div>
        ))}
      </div>
      {!trips.length ? <Empty icon="suitcase-rolling" title="Nenhuma viagem encontrada" /> : null}
      {creating ? (
        <FormDrawer
          title="Nova viagem"
          subtitle="Ela nasce em Rascunho: o cliente só vê depois de publicada."
          impact="Nome, destino e datas aparecem na capa do Início, com a contagem regressiva."
          impactWhere="Início"
          initial={{}}
          fields={[
            { key: 'trip_id', label: 'Código da viagem', required: true, placeholder: 'VG-2026-040', help: 'Código estável, sem espaços. Não muda depois (é o que liga planilha e app).' },
            { key: 'trip_name', label: 'Nome da viagem', required: true, placeholder: 'Paris e Londres', impact: 'Título grande da capa' },
            { key: 'destination_id', label: 'Destino principal', required: true, type: 'select', options: destOptions, help: 'Define a capa e o guia Explorar.' },
            { row: [ { key: 'start_date', label: 'Início', type: 'date', required: true, impact: 'Contagem regressiva' }, { key: 'end_date', label: 'Fim', type: 'date', required: true } ] },
            { key: 'trip_type', label: 'Tipo de viagem', type: 'select', options: [{ key: 'lazer', label: 'Lazer' }, { key: 'lua_de_mel', label: 'Lua de mel' }, { key: 'familia', label: 'Família' }, { key: 'aventura', label: 'Aventura' }], help: 'Usado nas regras da jornada de preparação.' },
            { key: 'general_notes', label: 'Recado geral', type: 'textarea', placeholder: 'Ex.: Leva adaptador de tomada tipo L!', impact: 'Card "Fica a dica" no Início' },
          ]}
          onSave={async (v) => {
            const r = await api.createTrip(v);
            toast('Viagem criada em rascunho ✅');
            reload();
            go(`viagem-${r.trip.id}`);
          }}
          onClose={() => setCreating(false)}
        />
      ) : null}
    </>
  );
}

const TABS = [
  ['resumo', 'Resumo', 'squares-four'],
  ['viajantes', 'Viajantes', 'users'],
  ['voos', 'Voos', 'airplane-tilt'],
  ['hospedagens', 'Hospedagens', 'bed'],
  ['roteiro', 'Roteiro', 'map-trifold'],
  ['documentos', 'Documentos', 'files'],
  ['tarefas', 'Tarefas', 'list-checks'],
  ['avisos', 'Avisos', 'megaphone'],
  ['destaques', 'Destaques do guia', 'seal-check'],
  ['historico', 'Histórico', 'clock-counter-clockwise'],
];

export function TripPage({ tripId, go }) {
  const { data, reload } = useData(() => api.trip(tripId), [tripId]);
  const [tab, setTab] = useState('resumo');
  const toast = useToast();
  if (!data) return <div className="empty">Carregando…</div>;
  const t = data.trip;
  const counts = { viajantes: data.travelers.length, voos: data.flights.length, hospedagens: data.accommodations.length, roteiro: data.itinerary.length, documentos: data.documents.length, tarefas: data.tasks.length, avisos: data.announcements.length, destaques: data.highlights.length };
  const publish = async (status) => {
    await api.updateTrip(t.id, { status });
    toast(status === 'published' ? 'Publicada! Agora envie os convites 🚀' : 'Viagem atualizada');
    reload();
  };
  return (
    <>
      <button className="btn ghost sm" onClick={() => go('viagens')} style={{ marginBottom: 10 }}>
        <Icon name="arrow-left" /> Viagens
      </button>
      <Cover art={art(t.destination_id)} height={190}>
        <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div className="row">
              <span className="small strong" style={{ opacity: 0.9 }}>{t.id}</span>
              <StatusBadge status={t.status} />
            </div>
            <h1 style={{ marginTop: 6 }}>{t.name}</h1>
            <div className="small" style={{ opacity: 0.9, marginTop: 4 }}>
              {destinationName(DESTINATIONS.find((d) => d.id === t.destination_id))} · {fmtDate(t.start_date)} → {fmtDate(t.end_date)} · fuso {t.timezone}
            </div>
          </div>
          <div className="row">
            {api.exportUrl(t.id) ? (
              <a className="btn secondary" href={api.exportUrl(t.id)}>
                <Icon name="download-simple" /> Exportar planilha
              </a>
            ) : (
              <Btn variant="secondary" icon="download-simple" onClick={() => toast('Na prévia o download fica desligado')}>
                Exportar planilha
              </Btn>
            )}
            {t.status === 'published' ? (
              <Btn variant="outline" onClick={() => publish('draft')} style={{ background: '#fff' }}>
                Voltar para rascunho
              </Btn>
            ) : (
              <Btn variant="accent" icon="paper-plane-tilt" onClick={() => publish('published')}>
                Publicar viagem
              </Btn>
            )}
          </div>
        </div>
      </Cover>
      <div className="tabs" style={{ marginTop: 18 }} role="tablist">
        {TABS.map(([k, l, i]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={`tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>
            <Icon name={i} /> {l} {counts[k] !== undefined ? <span className="n">{counts[k]}</span> : null}
          </button>
        ))}
      </div>
      {tab === 'resumo' ? <Summary data={data} setTab={setTab} publish={publish} /> : null}
      {tab === 'viajantes' ? <Travelers data={data} reload={reload} /> : null}
      {tab === 'voos' ? <Flights data={data} reload={reload} /> : null}
      {tab === 'hospedagens' ? <Stays data={data} reload={reload} /> : null}
      {tab === 'roteiro' ? <Itinerary data={data} reload={reload} /> : null}
      {tab === 'documentos' ? <Documents data={data} reload={reload} /> : null}
      {tab === 'tarefas' ? <Tasks data={data} reload={reload} go={go} /> : null}
      {tab === 'avisos' ? <Announcements data={data} reload={reload} /> : null}
      {tab === 'destaques' ? <Highlights data={data} reload={reload} /> : null}
      {tab === 'historico' ? <Audit tripId={t.id} /> : null}
    </>
  );
}

function Summary({ data, setTab, publish }) {
  const t = data.trip;
  const s = data.summary;
  const checks = [
    ['viajantes', 'Viajantes associados', s.travelers > 0, `${s.travelers} viajante(s), ${s.accepted} já no app`],
    ['voos', 'Voos', s.flights > 0, `${s.flights} trecho(s)`],
    ['hospedagens', 'Hospedagem', s.accommodations > 0, `${s.accommodations} hospedagem(ns)`],
    ['roteiro', 'Roteiro', s.itinerary > 0, `${s.itinerary} item(ns)`],
    ['documentos', 'Documentos visíveis', s.documents > 0, `${s.documents} visível(is) ao viajante`],
  ];
  const nextFlight = data.flights[0];
  return (
    <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) 300px', alignItems: 'start' }}>
      <div className="grid">
        <div className="card">
          <div className="card-title">
            <h2>Está pronta para o cliente?</h2>
            {s.essential_complete ? <Badge tone="green" icon="check-circle">Tudo certo</Badge> : <Badge tone="yellow" icon="warning">Pendências</Badge>}
          </div>
          <div className="grid" style={{ gap: 8 }}>
            {checks.map(([k, l, ok, d]) => (
              <button key={k} className="row" onClick={() => setTab(k)} style={{ border: 0, background: ok ? 'var(--success-bg)' : 'var(--warning-bg)', borderRadius: 12, padding: '10px 12px', cursor: 'pointer', textAlign: 'left' }}>
                <Icon name={ok ? 'check-circle' : 'warning-circle'} weight="fill" color={ok ? 'var(--success)' : 'var(--warning)'} size={22} />
                <span className="strong grow">{l}</span>
                <span className="small muted">{d}</span>
                <Icon name="caret-right" />
              </button>
            ))}
          </div>
          {t.status !== 'published' ? (
            <div style={{ marginTop: 16 }}>
              <Impact where="tudo">Enquanto estiver em Rascunho, o viajante não vê esta viagem. Ao publicar, ela aparece no app de quem está na aba Viajantes.</Impact>
              <div style={{ marginTop: 12 }}>
                <Btn variant="accent" icon="paper-plane-tilt" onClick={() => publish('published')}>
                  Publicar viagem
                </Btn>
              </div>
            </div>
          ) : null}
        </div>
        <div className="card">
          <div className="card-title">
            <h2>Informações gerais</h2>
          </div>
          <div className="grid g2 small">
            <div><div className="muted">Tipo</div><div className="strong">{t.trip_type || '—'}</div></div>
            <div><div className="muted">Fuso horário</div><div className="strong">{t.timezone}</div></div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div className="muted">Recado geral</div>
              <div className="strong">{t.general_notes || '—'}</div>
              <ImpactTag>Card "Fica a dica" no Início</ImpactTag>
            </div>
          </div>
        </div>
      </div>
      <div>
        <div className="small strong muted" style={{ marginBottom: 8 }}>Como o viajante vê</div>
        <div className="phone">
          <Cover art={art(t.destination_id)} height={190} style={{ borderRadius: 0 }}>
            <Badge tone="orange">Faltam {Math.max(0, Math.round((Date.parse(t.start_date) - Date.now()) / 86400000))} dias</Badge>
            <h2 style={{ marginTop: 6 }}>{t.name}</h2>
            <div className="small" style={{ opacity: 0.9 }}>{fmtDate(t.start_date)} a {fmtDate(t.end_date)}</div>
          </Cover>
          <div className="phone-body">
            <div className="card" style={{ padding: 12 }}>
              <div className="small muted strong">PREPARAÇÃO</div>
              <div className="progress" style={{ marginTop: 6 }}><div style={{ width: '30%' }} /></div>
            </div>
            {nextFlight ? (
              <div className="card purple" style={{ padding: 12 }}>
                <div className="small" style={{ opacity: 0.85 }}>{nextFlight.airline} · {nextFlight.flight_number}</div>
                <div style={{ fontFamily: 'var(--display)', fontSize: 22 }}>{nextFlight.departure_airport} ✈ {nextFlight.arrival_airport}</div>
              </div>
            ) : (
              <div className="card flat small muted" style={{ padding: 12 }}>Sem voo cadastrado: o card de voo não aparece.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Tabela genérica de itens com gaveta de edição. */
function ItemTab({ title, impact, impactWhere, how, rows, columns, fields, toCells, onSave, onDelete, emptyText, addLabel, extraActions, notifyOption = true }) {
  const [editing, setEditing] = useState(null);
  const [notify, setNotify] = useState(false);
  return (
    <>
      {how ? <HowTo steps={how} /> : null}
      <div className="card">
        <div className="card-title">
          <h2>{title}</h2>
          <Btn icon="plus-circle" onClick={() => setEditing({})}>
            {addLabel}
          </Btn>
        </div>
        <div style={{ marginBottom: 14 }}>
          <Impact where={impactWhere}>{impact}</Impact>
        </div>
        {rows.length ? (
          <table className="table">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c[0]}>{c[0]}</th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="click" onClick={() => setEditing(r)}>
                  {columns.map((c) => (
                    <td key={c[0]}>{c[1](r)}</td>
                  ))}
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                    {extraActions?.(r)}
                    {onDelete ? (
                      <button className="icon-btn" aria-label="Excluir" onClick={() => onDelete(r)}>
                        <Icon name="trash" />
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty icon="plus-circle" title="Nada cadastrado ainda">{emptyText}</Empty>
        )}
      </div>
      {editing ? (
        <FormDrawer
          title={editing.id ? `Editar` : addLabel}
          impact={impact}
          impactWhere={impactWhere}
          initial={editing.id ? toCells(editing) : {}}
          fields={fields}
          onSave={(v) => onSave(editing.id || null, notifyOption && editing.id ? { ...v, _notify: notify } : v)}
          onClose={() => {
            setEditing(null);
            setNotify(false);
          }}
          extra={
            notifyOption && editing.id ? (
              <div className="card soft row" style={{ padding: 14 }}>
                <Toggle on={notify} onChange={setNotify} label="Avisar viajantes" />
                <div>
                  <div className="strong">Avisar viajantes desta mudança</div>
                  <div className="small muted">Use para mudanças importantes (horário, local). Gera notificação no app e e-mail.</div>
                </div>
              </div>
            ) : null
          }
        />
      ) : null}
    </>
  );
}

function useItemActions(tripId, kind, reload) {
  const toast = useToast();
  return {
    onSave: async (itemId, cells) => {
      await api.saveItem(tripId, kind, itemId, cells);
      toast(itemId ? 'Atualizado ✅' : 'Adicionado ✅');
      reload();
    },
    onDelete: async (r) => {
      if (!window.confirm || window.confirm('Excluir este item? Ele some do app do viajante.')) {
        await api.deleteItem(tripId, kind, r.id);
        toast('Excluído');
        reload();
      }
    },
  };
}

const dt = (v) => (v ? String(v).slice(0, 16) : '');

function Travelers({ data, reload }) {
  const t = data.trip;
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [link, setLink] = useState(null);
  const INV = { not_sent: ['Convite não enviado', 'gray'], sent: ['Convite enviado', 'yellow'], accepted: ['No app ✓', 'green'], revoked: ['Removido', 'red'] };
  const invite = async (tt) => {
    try {
      const r = await api.invite(t.id, tt.id);
      setLink({ email: tt.email, ...r });
      reload();
    } catch (e) {
      toast(e.message);
    }
  };
  return (
    <>
      <HowTo
        steps={[
          'Adicione o e-mail de cada pessoa da viagem. Se ela ainda não tem conta, a conta é criada na hora — sem cadastro do lado do cliente.',
          'Com a viagem publicada, clique em "Enviar convite": a pessoa recebe um link pessoal, de uso único, que abre o app direto.',
          'Depois disso ela entra só com o e-mail (código de 6 números), Apple ou Google.',
        ]}
      />
      <div className="card">
        <div className="card-title">
          <h2>Quem vai viajar</h2>
          <Btn icon="user-plus" onClick={() => setAdding(true)}>Adicionar viajante</Btn>
        </div>
        <div style={{ marginBottom: 14 }}>
          <Impact where="acesso">Só quem está nesta lista enxerga a viagem e os documentos dela no app. Criança no grupo ativa a tarefa de autorização de viagem para menores.</Impact>
        </div>
        {data.travelers.length ? (
          <table className="table">
            <thead><tr><th>Viajante</th><th>Papel</th><th>Situação</th><th /></tr></thead>
            <tbody>
              {data.travelers.map((x) => (
                <tr key={x.id}>
                  <td><div className="row"><Avatar seed={x.email} size={36} /><div><div className="strong">{x.name}</div><div className="small muted">{x.email}</div></div></div></td>
                  <td><Badge>{x.traveler_role}</Badge></td>
                  <td><Badge tone={INV[x.invitation_status][1]}>{INV[x.invitation_status][0]}</Badge></td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <Btn sm variant={x.invitation_status === 'accepted' ? 'ghost' : 'secondary'} icon="paper-plane-tilt" onClick={() => invite(x)}>
                      {x.invitation_status === 'not_sent' ? 'Enviar convite' : 'Reenviar'}
                    </Btn>
                    <button className="icon-btn" aria-label="Remover" onClick={async () => { await api.removeTraveler(t.id, x.id); reload(); }}><Icon name="trash" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty icon="users" title="Ninguém por aqui ainda">Adicione o e-mail de quem vai viajar.</Empty>
        )}
      </div>
      {link ? (
        <div className="overlay" style={{ alignItems: 'center' }} onClick={() => setLink(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Convite enviado! ✉️</h2>
            <p className="muted" style={{ marginTop: 6 }}>Mandamos para <b>{link.email}</b>. O link é pessoal, funciona uma vez e vale até {fmtDate(link.expires_at)}.</p>
            <div className="card flat mono small" style={{ marginTop: 14, wordBreak: 'break-all' }}>{link.invite_url}</div>
            <div className="row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
              <Btn variant="secondary" icon="copy" onClick={() => navigator.clipboard?.writeText(link.invite_url).then(() => toast('Link copiado'), () => toast('Copie manualmente'))}>Copiar link</Btn>
              <Btn onClick={() => setLink(null)}>Fechou</Btn>
            </div>
          </div>
        </div>
      ) : null}
      {adding ? (
        <FormDrawer
          title="Adicionar viajante"
          impact="A viagem aparece no app desta pessoa (depois de publicada)."
          impactWhere="acesso"
          fields={[
            { key: 'traveler_email', label: 'E-mail', required: true, type: 'email', placeholder: 'cliente@email.com', help: 'É com ele que a pessoa entra no app.' },
            { key: 'traveler_name', label: 'Nome', required: true, impact: '"Oi, Ana!" no Início' },
            { key: 'role', label: 'Papel', type: 'select', options: [{ key: 'titular', label: 'Titular' }, { key: 'acompanhante', label: 'Acompanhante' }, { key: 'crianca', label: 'Criança' }] },
            { row: [{ key: 'phone_optional', label: 'Telefone (opcional)' }, { key: 'nationality', label: 'Nacionalidade (opcional)', help: 'Ajusta as tarefas de documentação.' }] },
          ]}
          onSave={async (v) => { await api.addTraveler(t.id, v); toast('Viajante adicionado ✅'); reload(); }}
          onClose={() => setAdding(false)}
        />
      ) : null}
    </>
  );
}

function Flights({ data, reload }) {
  const a = useItemActions(data.trip.id, 'flights', reload);
  return (
    <ItemTab
      title="Voos"
      addLabel="Adicionar trecho"
      impactWhere="Início e Roteiro"
      impact='O próximo voo vira o cartão de embarque do Início ("Próximo voo"); cada trecho aparece no Roteiro no dia da partida.'
      how={['Cadastre cada trecho com o número de ordem (1, 2, 3…). Esse número é a chave para atualizar sem duplicar.', 'Datas e horas sempre no horário local de cada aeroporto.', 'Mudou o horário? Edite e marque "Avisar viajantes".']}
      rows={[...data.flights].sort((x, y) => x.segment_order - y.segment_order)}
      columns={[
        ['#', (r) => <b>{r.segment_order}</b>],
        ['Voo', (r) => <><div className="strong">{r.airline} · {r.flight_number}</div><div className="small muted">Localizador {r.booking_reference || '—'}</div></>],
        ['Trecho', (r) => <b>{r.departure_airport} → {r.arrival_airport}</b>],
        ['Partida', (r) => fmtDateTime(r.departure_at)],
        ['Chegada', (r) => fmtDateTime(r.arrival_at)],
      ]}
      fields={[
        { row: [{ key: 'segment_order', label: 'Ordem', type: 'number', required: true }, { key: 'flight_number', label: 'Número do voo', required: true, placeholder: 'AZ 675' }] },
        { key: 'airline', label: 'Companhia', required: true },
        { row: [{ key: 'departure_airport', label: 'Partida (IATA)', required: true, placeholder: 'GRU' }, { key: 'departure_datetime', label: 'Data/hora local', type: 'datetime-local', required: true }] },
        { row: [{ key: 'arrival_airport', label: 'Chegada (IATA)', required: true, placeholder: 'FCO' }, { key: 'arrival_datetime', label: 'Data/hora local', type: 'datetime-local', required: true }] },
        { key: 'booking_reference', label: 'Localizador', impact: 'Aparece no cartão do voo' },
        { key: 'notes', label: 'Observações', type: 'textarea', placeholder: 'Bagagem, assentos…', impact: 'Card "Bagagem e assentos"' },
      ]}
      toCells={(r) => ({ segment_order: r.segment_order, airline: r.airline, flight_number: r.flight_number, departure_airport: r.departure_airport, departure_datetime: dt(r.departure_at), arrival_airport: r.arrival_airport, arrival_datetime: dt(r.arrival_at), booking_reference: r.booking_reference, notes: r.notes })}
      emptyText="Sem voo, o card de voo some do Início."
      {...a}
    />
  );
}

const cityOptions = DESTINATIONS.filter((d) => d.city).map((d) => ({ key: d.id, label: `${d.city} (${d.country})` }));

function Stays({ data, reload }) {
  const a = useItemActions(data.trip.id, 'accommodations', reload);
  return (
    <ItemTab
      title="Hospedagens"
      addLabel="Adicionar hospedagem"
      impactWhere="Início, Roteiro e Explorar"
      impact='"Sua hospedagem" no Início, check-in/check-out no Roteiro. Com latitude/longitude, libera o filtro "Perto do hotel" no Explorar.'
      rows={data.accommodations}
      columns={[
        ['Hospedagem', (r) => <><div className="strong">{r.name}</div><div className="small muted">{r.address}</div></>],
        ['Cidade', (r) => destinationName(DESTINATIONS.find((d) => d.id === r.city_id)) || '—'],
        ['Check-in', (r) => fmtDateTime(r.checkin_at)],
        ['Check-out', (r) => fmtDateTime(r.checkout_at)],
      ]}
      fields={[
        { key: 'property_name', label: 'Nome', required: true },
        { key: 'city_id', label: 'Cidade', type: 'select', options: cityOptions, impact: 'Selo da cidade no Roteiro' },
        { row: [{ key: 'checkin_datetime', label: 'Check-in', type: 'datetime-local', required: true }, { key: 'checkout_datetime', label: 'Check-out', type: 'datetime-local', required: true }] },
        { key: 'address', label: 'Endereço', impact: 'Botão "Abrir no mapa"' },
        { key: 'confirmation_code', label: 'Código de confirmação' },
        { key: 'notes', label: 'Bom saber', type: 'textarea', placeholder: 'Café da manhã, horário da recepção…' },
      ]}
      toCells={(r) => ({ property_name: r.name, city_id: r.city_id, checkin_datetime: dt(r.checkin_at), checkout_datetime: dt(r.checkout_at), address: r.address, confirmation_code: r.confirmation_code, notes: r.notes })}
      {...a}
    />
  );
}

function Itinerary({ data, reload, settings }) {
  const a = useItemActions(data.trip.id, 'itinerary', reload);
  const cats = [['transfer', 'Transfer'], ['passeio', 'Passeio'], ['experiencia', 'Experiência'], ['restaurante', 'Restaurante'], ['ingresso', 'Ingresso / atração'], ['transporte', 'Trem / ônibus'], ['livre', 'Tempo livre'], ['outro', 'Outro']].map(([key, label]) => ({ key, label }));
  const STATUS = { confirmado: 'green', pendente: 'yellow', cancelado: 'red', nao_necessario: 'gray' };
  return (
    <ItemTab
      title="Roteiro"
      addLabel="Adicionar atividade"
      impactWhere="Roteiro e Início"
      impact='Cada item aparece no dia certo da aba Roteiro (junto com voos e check-ins). Os 3 próximos aparecem em "Próximos rolês" no Início.'
      how={['Um item por atividade: data, horário (opcional), título e categoria.', 'Use "Situação da reserva" para o viajante saber o que já está garantido.', 'Endereço preenchido = botão "Abrir no mapa" no app.']}
      rows={[...data.itinerary].sort((x, y) => (x.date + (x.start_time || '')).localeCompare(y.date + (y.start_time || '')))}
      columns={[
        ['Dia', (r) => <b>{fmtDate(r.date)}</b>],
        ['Hora', (r) => r.start_time || '—'],
        ['Atividade', (r) => <><div className="strong">{r.title}</div><div className="small muted">{cats.find((c) => c.key === r.category)?.label}</div></>],
        ['Reserva', (r) => (r.booking_status ? <Badge tone={STATUS[r.booking_status]}>{r.booking_status.replace('_', ' ')}</Badge> : '—')],
      ]}
      fields={[
        { row: [{ key: 'date', label: 'Data', type: 'date', required: true }, { key: 'category', label: 'Categoria', type: 'select', required: true, options: cats, impact: 'Ícone do item' }] },
        { row: [{ key: 'start_time', label: 'Início', type: 'time' }, { key: 'end_time', label: 'Fim', type: 'time' }] },
        { key: 'title', label: 'Título', required: true, placeholder: 'Visita guiada ao Coliseu' },
        { key: 'city_id', label: 'Cidade', type: 'select', options: cityOptions },
        { key: 'address', label: 'Endereço', impact: 'Botão "Abrir no mapa"' },
        { key: 'booking_status', label: 'Situação da reserva', type: 'select', options: [{ key: 'confirmado', label: 'Confirmado' }, { key: 'pendente', label: 'Pendente' }, { key: 'nao_necessario', label: 'Não precisa de reserva' }, { key: 'cancelado', label: 'Cancelado' }], impact: 'Selo colorido no item' },
        { key: 'confirmation_code', label: 'Código de confirmação' },
        { key: 'description', label: 'O que o viajante precisa saber', type: 'textarea', placeholder: 'Ponto de encontro, o que levar…' },
      ]}
      toCells={(r) => ({ date: r.date, start_time: r.start_time, end_time: r.end_time, title: r.title, category: r.category, city_id: r.city_id, address: r.address, booking_status: r.booking_status, confirmation_code: r.confirmation_code, description: r.description })}
      {...a}
    />
  );
}

function Documents({ data, reload }) {
  const t = data.trip;
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const CATS = [['bilhete', 'Bilhete aéreo'], ['reserva', 'Reserva / hospedagem'], ['voucher', 'Voucher'], ['ingresso', 'Ingresso'], ['seguro', 'Seguro viagem'], ['orientacao', 'Orientações'], ['outro', 'Outro']].map(([key, label]) => ({ key, label }));
  const toggle = async (d) => {
    await api.updateDocument(t.id, d.id, { visible_to_traveler: !d.visible_to_traveler });
    toast(!d.visible_to_traveler ? 'Visível no app — o viajante foi avisado 🔔' : 'Agora só a equipe vê');
    reload();
  };
  const replace = (d) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.png,.jpg,.jpeg,.webp';
    input.onchange = async () => {
      const f = new FormData();
      f.append('file', input.files[0]);
      await api.replaceDocument(t.id, d.id, f);
      toast('Nova versão enviada. A anterior fica no histórico.');
      reload();
    };
    input.click();
  };
  return (
    <>
      <HowTo
        steps={[
          'Envie PDF ou imagem (JPG, PNG, WEBP). O sistema confere o conteúdo do arquivo, não só a extensão.',
          '"Visível ao viajante" desligado = só a equipe vê (contratos, documentos internos).',
          'Para atualizar um voucher, use "Nova versão": o viajante vê sempre a mais recente e a equipe mantém o histórico.',
        ]}
      />
      <div className="card">
        <div className="card-title">
          <h2>Documentos</h2>
          <Btn icon="upload-simple" onClick={() => setAdding(true)}>Enviar documento</Btn>
        </div>
        <div style={{ marginBottom: 14 }}>
          <Impact where="Docs">Aparecem na aba Docs, agrupados por categoria, e podem ser salvos offline. Documento novo ou atualizado e visível gera notificação para o viajante.</Impact>
        </div>
        <table className="table">
          <thead><tr><th>Documento</th><th>Categoria</th><th>Versão</th><th>Visível ao viajante</th><th /></tr></thead>
          <tbody>
            {data.documents.map((d) => (
              <tr key={d.id}>
                <td className="row"><Icon name="file-pdf" size={24} weight="duotone" color="var(--danger)" /><div><div className="strong">{d.title}</div><div className="small muted">{d.source_name}</div></div></td>
                <td>{CATS.find((c) => c.key === d.category)?.label}</td>
                <td>v{d.version}</td>
                <td><div className="row"><Toggle on={!!d.visible_to_traveler} onChange={() => toggle(d)} label="Visível ao viajante" /><span className="small muted">{d.visible_to_traveler ? 'Sim' : 'Só equipe'}</span></div></td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <Btn sm variant="ghost" icon="arrows-clockwise" onClick={() => replace(d)}>Nova versão</Btn>
                  <button className="icon-btn" aria-label="Excluir" onClick={async () => { await api.deleteDocument(t.id, d.id); reload(); }}><Icon name="trash" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data.documents.length ? <Empty icon="files" title="Nenhum documento">Envie vouchers, bilhetes, seguro e ingressos.</Empty> : null}
      </div>
      {adding ? (
        <FormDrawer
          title="Enviar documento"
          impact="Aparece na aba Docs (se visível) e o viajante recebe uma notificação."
          impactWhere="Docs"
          initial={{ visible: true, category: 'voucher' }}
          fields={[
            { key: 'file', label: 'Arquivo', type: 'file', required: true, accept: '.pdf,.png,.jpg,.jpeg,.webp' },
            { key: 'file_name', label: 'Nome que o viajante vê', placeholder: 'Voucher do transfer em Roma' },
            { row: [{ key: 'category', label: 'Categoria', type: 'select', required: true, options: CATS }, { key: 'stage', label: 'Etapa', type: 'select', options: [{ key: 'antes', label: 'Antes de viajar' }, { key: 'ida', label: 'Ida' }, { key: 'destino', label: 'No destino' }, { key: 'volta', label: 'Volta' }] }] },
            { key: 'visible', label: 'Visível ao viajante', type: 'toggle', onText: 'Sim, aparece no app', offText: 'Não, só a equipe vê' },
            { key: 'notes', label: 'Recado (opcional)', type: 'textarea', impact: '"Recado da Vagari" no documento' },
          ]}
          onSave={async (v) => {
            const f = new FormData();
            if (v.file) f.append('file', v.file);
            for (const k of ['file_name', 'category', 'stage', 'notes']) if (v[k]) f.append(k, v[k]);
            f.append('visible_to_traveler', v.visible ? 'sim' : 'não');
            await api.uploadDocument(t.id, f);
            toast('Documento enviado ✅');
            reload();
          }}
          onClose={() => setAdding(false)}
        />
      ) : null}
    </>
  );
}

function Tasks({ data, reload, go }) {
  const a = useItemActions(data.trip.id, 'tasks', reload);
  const PR = { alta: 'red', media: '', baixa: 'green' };
  return (
    <ItemTab
      title="Tarefas de preparação"
      addLabel="Tarefa só desta viagem"
      impactWhere="Preparação e Início"
      impact="Aparecem na aba Preparação e contam no anel de progresso do Início. Cada viajante marca as suas. Lembrete automático alguns dias antes do prazo."
      how={[
        'As tarefas com o selo "Automática" vêm das regras da Jornada de preparação e se ajustam sozinhas quando a data muda.',
        'Para mudar uma tarefa automática, edite a regra (menu Jornada de preparação).',
        'Use "Tarefa só desta viagem" para pedidos específicos (ex.: escolher horário de um passeio).',
      ]}
      rows={data.tasks}
      columns={[
        ['Tarefa', (r) => <><div className="strong">{r.title}</div>{r.source === 'rule' ? <Badge tone="soft-orange" icon="arrows-clockwise">Automática</Badge> : <Badge>Desta viagem</Badge>}</>],
        ['Prazo', (r) => (r.due_date ? fmtDate(r.due_date) : 'Assim que possível')],
        ['Prioridade', (r) => <Badge tone={PR[r.priority]}>{r.priority}</Badge>],
        ['Feita por', (r) => `${r.completions || 0} de ${data.travelers.length}`],
      ]}
      fields={[
        { key: 'title', label: 'Tarefa', required: true, placeholder: 'Escolher horário do passeio' },
        { key: 'description', label: 'Explicação', type: 'textarea' },
        { row: [{ key: 'due_date', label: 'Prazo', type: 'date' }, { key: 'priority', label: 'Prioridade', type: 'select', options: [{ key: 'alta', label: 'Alta' }, { key: 'media', label: 'Média' }, { key: 'baixa', label: 'Baixa' }] }] },
      ]}
      toCells={(r) => ({ title: r.title, description: r.description, due_date: r.due_date, priority: r.priority })}
      onSave={async (id, cells) => {
        const row = data.tasks.find((x) => x.id === id);
        if (row?.source === 'rule') {
          go('jornada');
          return false;
        }
        return a.onSave(id, cells);
      }}
      onDelete={(r) => (r.source === 'rule' ? go('jornada') : a.onDelete(r))}
      notifyOption={false}
    />
  );
}

function Announcements({ data, reload }) {
  const toast = useToast();
  const [form, setForm] = useState({ title: '', body: '', essential: false });
  const send = async () => {
    try {
      const r = await api.announce({ trip_ids: [data.trip.id], ...form });
      toast(`Aviso publicado para ${r.notified} viajante(s) 📣`);
      setForm({ title: '', body: '', essential: false });
      reload();
    } catch (e) {
      toast(e.message);
    }
  };
  return (
    <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) 300px', alignItems: 'start' }}>
      <div className="grid">
        <div className="card">
          <h2>Novo aviso</h2>
          <div className="grid" style={{ gap: 12, marginTop: 14 }}>
            <input className="input" placeholder="Título (ex.: Greve de trens na quinta)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <textarea className="input" placeholder="Mensagem — fala como amigo, curto e claro." value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
            <label className="row"><Toggle on={form.essential} onChange={(v) => setForm({ ...form, essential: v })} label="Essencial" /> <span><b>Essencial</b> <span className="muted small">— vai por e-mail mesmo para quem desligou notificações. Use só para segurança/operação.</span></span></label>
            <Impact where="Início">Card no topo do Início + notificação no app. Essencial fica vermelho.</Impact>
            <div><Btn icon="megaphone" onClick={send}>Publicar aviso</Btn></div>
          </div>
        </div>
        <div className="card">
          <h2>Avisos publicados</h2>
          {data.announcements.length ? (
            <div className="timeline" style={{ marginTop: 14 }}>
              {data.announcements.map((a) => (
                <div key={a.id} className="tl-item">
                  <div className="row"><b>{a.title}</b>{a.essential ? <Badge tone="red">Essencial</Badge> : null}</div>
                  <div className="small muted">{a.body}</div>
                  <div className="small muted">{fmtDateTime(a.created_at)}</div>
                </div>
              ))}
            </div>
          ) : <Empty icon="megaphone" title="Nenhum aviso ainda" />}
        </div>
      </div>
      <div>
        <div className="small strong muted" style={{ marginBottom: 8 }}>Prévia no app</div>
        <div className="phone">
          <div className="phone-body">
            <div className="card" style={{ padding: 14, background: form.essential ? 'var(--danger-bg)' : 'var(--purple600)', color: form.essential ? 'var(--ink)' : '#fff' }}>
              <div className="row"><Icon name="megaphone" weight="duotone" /><b>{form.title || 'Título do aviso'}</b></div>
              <div className="small" style={{ marginTop: 4, opacity: 0.9 }}>{form.body || 'Sua mensagem aparece aqui.'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Highlights({ data, reload }) {
  const toast = useToast();
  const { data: pl } = useData(() => api.places({ status: 'approved' }), []);
  const [placeId, setPlaceId] = useState('');
  const [note, setNote] = useState('');
  const ids = useMemo(() => {
    const out = new Set([data.trip.destination_id, ...data.accommodations.map((a) => a.city_id)]);
    let grew = true;
    while (grew) { grew = false; for (const d of DESTINATIONS) if (d.parent && out.has(d.parent) && !out.has(d.id)) { out.add(d.id); grew = true; } }
    return out;
  }, [data]);
  const options = (pl?.places || []).filter((p) => ids.has(p.destination_id));
  const add = async () => {
    const r = await api.setHighlight(data.trip.id, placeId, note);
    toast(r.warning || 'Indicação adicionada ⭐');
    setPlaceId(''); setNote('');
    reload();
  };
  return (
    <>
      <HowTo steps={['Escolha lugares aprovados da biblioteca e escreva um recado curto, do jeito Vagari.', 'Eles ficam no topo do Explorar com o selo laranja "Indicação Vagari".']} />
      <div className="card">
        <div className="card-title"><h2>Indicações da Vagari para esta viagem</h2></div>
        <Impact where="Explorar">Carrossel "Indicações da Vagari" no topo do Explorar, com o seu recado entre aspas.</Impact>
        <div className="row wrap" style={{ marginTop: 14 }}>
          <select className="input" style={{ maxWidth: 300 }} value={placeId} onChange={(e) => setPlaceId(e.target.value)}>
            <option value="">Escolha um lugar…</option>
            {options.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input className="input grow" placeholder='Recado (ex.: "Vai cedinho, antes das 8h")' value={note} onChange={(e) => setNote(e.target.value)} />
          <Btn icon="seal-check" disabled={!placeId} onClick={add}>Indicar</Btn>
        </div>
        <div className="grid g3" style={{ marginTop: 18 }}>
          {data.highlights.map((h) => (
            <div key={h.place_id} className="card flat">
              <div className="row" style={{ justifyContent: 'space-between' }}><Badge tone="orange" icon="seal-check">Indicação Vagari</Badge><button className="icon-btn" aria-label="Remover" onClick={async () => { await api.removeHighlight(data.trip.id, h.place_id); reload(); }}><Icon name="x" /></button></div>
              <h3 style={{ marginTop: 8 }}>{h.name}</h3>
              <p className="small muted">“{h.note}”</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
