/** Início do painel, avisos em grupo, jornada, configurações, equipe, histórico, métricas, LGPD, guia e login. */
import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { FormDrawer } from '../form.jsx';
import { Badge, Btn, Empty, HowTo, Icon, Impact, ImpactTag, StatusBadge, Toggle, fmtDate, fmtDateTime, useToast } from '../ui.jsx';
import { Audit, useData } from './common.jsx';

export function DashboardPage({ go, user }) {
  const m = useData(() => api.metrics(), []).data;
  const trips = useData(() => api.trips({}), []).data?.trips || [];
  const places = useData(() => api.places({ status: 'pending_review' }), []).data;
  const privacy = useData(() => api.privacyRequests(), []).data?.requests || [];
  const upcoming = trips.filter((t) => t.status !== 'archived' && t.end_date >= new Date().toISOString().slice(0, 10)).slice(0, 5);
  const incomplete = trips.filter((t) => ['draft', 'published'].includes(t.status) && !t.summary.essential_complete);
  const notInvited = trips.filter((t) => t.status === 'published' && t.travelers?.some?.((x) => x.invitation_status === 'not_sent'));
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Oi, {(user?.name || '').split(' ')[0] || 'time'}! 👋</h1>
          <p>Aqui está o que precisa da sua atenção hoje.</p>
        </div>
        <div className="row">
          <Btn variant="secondary" icon="file-xls" onClick={() => go('importar')}>Importar planilha</Btn>
          <Btn icon="plus-circle" onClick={() => go('viagens')}>Nova viagem</Btn>
        </div>
      </div>
      {m ? (
        <div className="grid g4">
          <div className="card purple kpi"><div className="label">Viajantes ativos no app</div><div className="value">{m.activation.percent ?? '—'}%</div><div className="small muted">{m.activation.activated} de {m.activation.invited} convidados</div></div>
          <div className="card kpi"><div className="label">Viagens completas</div><div className="value">{m.trips_essential_complete.complete}/{m.trips_essential_complete.trips}</div><div className="small muted">com voo, hotel, viajante e doc</div></div>
          <div className="card kpi"><div className="label">Tarefas concluídas</div><div className="value">{m.tasks.percent}%</div><div className="small muted">pelos viajantes</div></div>
          <div className="card kpi"><div className="label">Cliques no WhatsApp</div><div className="value">{m.whatsapp_clicks}</div><div className="small muted">nos últimos {m.period_days} dias</div></div>
        </div>
      ) : null}
      <div className="grid g2" style={{ marginTop: 18, alignItems: 'start' }}>
        <div className="card">
          <div className="card-title"><h2>Pendências</h2></div>
          <div className="grid" style={{ gap: 10 }}>
            {incomplete.map((t) => (
              <button key={t.id} className="row" onClick={() => go(`viagem-${t.id}`)} style={{ border: 0, background: 'var(--warning-bg)', borderRadius: 12, padding: 12, cursor: 'pointer', textAlign: 'left' }}>
                <Icon name="warning" weight="fill" color="var(--warning)" size={20} />
                <span className="grow"><b>{t.name}</b><div className="small muted">Faltam: {t.summary.missing.join(', ')}</div></span>
                <Icon name="caret-right" />
              </button>
            ))}
            {places?.counts?.pending_review ? (
              <button className="row" onClick={() => go('lugares')} style={{ border: 0, background: 'var(--purple50)', borderRadius: 12, padding: 12, cursor: 'pointer', textAlign: 'left' }}>
                <Icon name="compass" weight="duotone" color="var(--purple600)" size={20} />
                <span className="grow"><b>{places.counts.pending_review} lugares para revisar</b><div className="small muted">Só aparecem no app depois de publicados</div></span>
                <Icon name="caret-right" />
              </button>
            ) : null}
            {privacy.filter((p) => p.status === 'open').map((p) => (
              <button key={p.id} className="row" onClick={() => go('lgpd')} style={{ border: 0, background: 'var(--danger-bg)', borderRadius: 12, padding: 12, cursor: 'pointer', textAlign: 'left' }}>
                <Icon name="shield-check" weight="duotone" color="var(--danger)" size={20} />
                <span className="grow"><b>Pedido LGPD de {p.name}</b><div className="small muted">{p.kind === 'deletion' ? 'Exclusão de dados' : p.kind}</div></span>
                <Icon name="caret-right" />
              </button>
            ))}
            {!incomplete.length && !places?.counts?.pending_review && !privacy.length ? <Empty icon="confetti" title="Tudo em dia!" /> : null}
          </div>
        </div>
        <div className="card">
          <div className="card-title"><h2>Próximas viagens</h2><Btn sm variant="ghost" onClick={() => go('viagens')}>Ver todas</Btn></div>
          <table className="table">
            <tbody>
              {upcoming.map((t) => (
                <tr key={t.id} className="click" onClick={() => go(`viagem-${t.id}`)}>
                  <td><b>{t.name}</b><div className="small muted">{t.id} · {t.city}</div></td>
                  <td className="small">{fmtDate(t.start_date)}</td>
                  <td><StatusBadge status={t.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {notInvited.length ? null : null}
    </>
  );
}

export function BroadcastPage() {
  const toast = useToast();
  const trips = useData(() => api.trips({ status: 'published' }), []).data?.trips || [];
  const [sel, setSel] = useState(new Set());
  const [form, setForm] = useState({ title: '', body: '', essential: false });
  const send = async () => {
    try {
      const r = await api.announce({ trip_ids: [...sel], ...form });
      toast(`Aviso enviado para ${sel.size} viagem(ns) · ${r.notified} viajante(s) 📣`);
      setForm({ title: '', body: '', essential: false });
      setSel(new Set());
    } catch (e) {
      toast(e.message);
    }
  };
  return (
    <>
      <div className="page-head"><div><h1>Avisos em grupo</h1><p>Mande o mesmo recado para várias viagens de uma vez (ex.: greve num aeroporto, mudança de regra de entrada).</p></div></div>
      <HowTo steps={['Escolha as viagens publicadas que devem receber.', 'Escreva curto e claro, no tom Vagari.', 'Marque "Essencial" só para segurança/operação: vai por e-mail mesmo pra quem desligou notificações.']} />
      <div className="grid g2" style={{ alignItems: 'start' }}>
        <div className="card">
          <h2>Para quem</h2>
          <div className="grid" style={{ gap: 8, marginTop: 12 }}>
            {trips.map((t) => (
              <label key={t.id} className="row card flat" style={{ padding: 12, cursor: 'pointer' }}>
                <input type="checkbox" checked={sel.has(t.id)} onChange={() => { const s = new Set(sel); s.has(t.id) ? s.delete(t.id) : s.add(t.id); setSel(s); }} />
                <span className="grow"><b>{t.name}</b><div className="small muted">{t.id} · {fmtDate(t.start_date)} · {t.summary.travelers} viajante(s)</div></span>
              </label>
            ))}
          </div>
        </div>
        <div className="card">
          <h2>Mensagem</h2>
          <div className="grid" style={{ gap: 12, marginTop: 12 }}>
            <input className="input" placeholder="Título" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <textarea className="input" placeholder="Mensagem" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
            <label className="row"><Toggle on={form.essential} onChange={(v) => setForm({ ...form, essential: v })} label="Essencial" /> <b>Essencial</b></label>
            <Impact where="Início">Card de aviso no Início + notificação no app (+ e-mail se essencial ou se o viajante deixou ligado).</Impact>
            <Btn icon="megaphone" disabled={!sel.size} onClick={send}>Enviar para {sel.size} viagem(ns)</Btn>
          </div>
        </div>
      </div>
    </>
  );
}

const COND_LABEL = { international: (v) => (v ? 'Só internacionais' : 'Só nacionais'), has_children: (v) => (v ? 'Com criança no grupo' : 'Sem criança'), trip_types: (v) => `Tipo: ${v.join(', ')}`, countries: (v) => `Países: ${v.join(', ')}`, min_days: (v) => `Mín. ${v} dias`, max_days: (v) => `Máx. ${v} dias`, nationalities: (v) => `Nacionalidade: ${v.join(', ')}` };

export function RulesPage() {
  const toast = useToast();
  const { data, reload } = useData(() => api.rules(), []);
  const [editing, setEditing] = useState(null);
  const rules = [...(data?.rules || [])].sort((a, b) => (b.days_before ?? 999) - (a.days_before ?? 999));
  return (
    <>
      <div className="page-head">
        <div><h1>Jornada de preparação</h1><p>Regras que viram tarefas automáticas em cada viagem, com prazo calculado a partir da data de embarque.</p></div>
        <Btn icon="plus-circle" onClick={() => setEditing({ conditions: {} })}>Nova regra</Btn>
      </div>
      <HowTo steps={['Cada regra vira uma tarefa em todas as viagens que combinam com as condições (internacional, criança no grupo, tipo de viagem…).', 'O prazo é "X dias antes do embarque". Sem dias = "faz agora".', 'Editar uma regra atualiza na hora as tarefas de todas as viagens ativas — sem apagar o que o viajante já marcou como feito.', 'As regras iniciais são exemplos: revise textos e links oficiais antes de usar com clientes.']} />
      <Impact where="Preparação e Início">As tarefas aparecem na aba Preparação, contam no anel de progresso do Início e geram lembrete alguns dias antes do prazo.</Impact>
      <div className="card" style={{ marginTop: 18 }}>
        <div className="timeline">
          {rules.map((r) => (
            <div key={r.id} className="tl-item" style={{ cursor: 'pointer' }} onClick={() => setEditing(r)}>
              <div className="row wrap">
                <Badge tone="soft-orange">{r.days_before === null || r.days_before === undefined ? 'Assim que a viagem é criada' : `${r.days_before} dias antes`}</Badge>
                <b>{r.title}</b>
                {!r.active ? <Badge tone="gray">Desativada</Badge> : null}
                <Badge tone={r.priority === 'alta' ? 'red' : ''}>{r.priority}</Badge>
              </div>
              <div className="row wrap small" style={{ marginTop: 4 }}>
                {Object.entries(r.conditions || {}).length ? Object.entries(r.conditions).map(([k, v]) => <Badge key={k}>{COND_LABEL[k]?.(v) || k}</Badge>) : <span className="muted">Vale para todas as viagens</span>}
                {r.official_url ? <Badge tone="green" icon="link">fonte oficial</Badge> : null}
              </div>
            </div>
          ))}
        </div>
      </div>
      {editing ? (
        <FormDrawer
          title={editing.id ? 'Editar regra' : 'Nova regra'}
          impact="Ao salvar, as tarefas de todas as viagens ativas são recalculadas."
          impactWhere="Preparação"
          initial={{ ...editing, international: editing.conditions?.international ?? '', has_children: editing.conditions?.has_children ?? '', trip_types: (editing.conditions?.trip_types || []).join(', '), active: editing.active !== false }}
          fields={[
            { key: 'title', label: 'Título da tarefa', required: true, impact: 'Título na Preparação' },
            { key: 'description', label: 'Explicação (tom de amigo)', type: 'textarea' },
            { row: [{ key: 'days_before', label: 'Dias antes do embarque', type: 'number', help: 'Vazio = assim que a viagem for criada' }, { key: 'priority', label: 'Prioridade', type: 'select', options: [{ key: 'alta', label: 'Alta' }, { key: 'media', label: 'Média' }, { key: 'baixa', label: 'Baixa' }] }] },
            { key: 'official_url', label: 'Link oficial', type: 'url', impact: 'Botão "Abrir site oficial"' },
            { row: [{ key: 'international', label: 'Destino', type: 'select', options: [{ key: 'true', label: 'Só internacionais' }, { key: 'false', label: 'Só nacionais' }], placeholder: 'Qualquer' }, { key: 'has_children', label: 'Criança no grupo', type: 'select', options: [{ key: 'true', label: 'Só com criança' }, { key: 'false', label: 'Só sem criança' }], placeholder: 'Tanto faz' }] },
            { key: 'trip_types', label: 'Tipos de viagem (separados por vírgula)', placeholder: 'familia, lua_de_mel' },
            { key: 'active', label: 'Regra ativa', type: 'toggle' },
          ]}
          onSave={async (v) => {
            const conditions = {};
            if (v.international !== '' && v.international !== undefined && v.international !== null) conditions.international = String(v.international) === 'true';
            if (v.has_children !== '' && v.has_children !== undefined && v.has_children !== null) conditions.has_children = String(v.has_children) === 'true';
            if (v.trip_types) conditions.trip_types = String(v.trip_types).split(',').map((s) => s.trim()).filter(Boolean);
            const body = { title: v.title, description: v.description, days_before: v.days_before === '' || v.days_before === undefined || v.days_before === null ? null : Number(v.days_before), priority: v.priority || 'media', official_url: v.official_url || null, conditions, active: !!v.active };
            const r = await api.saveRule(editing.id || null, body);
            toast(`Regra salva · ${r.synced_trips ?? ''} viagem(ns) atualizada(s)`);
            reload();
          }}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}

export function SettingsPage() {
  const toast = useToast();
  const { data, reload } = useData(() => api.settings(), []);
  const [s, setS] = useState(null);
  useEffect(() => { if (data) setS(data.settings); }, [data]);
  if (!s) return <div className="empty">Carregando…</div>;
  const save = async (keys) => {
    try {
      await api.saveSettings(Object.fromEntries(keys.map((k) => [k, s[k]])));
      toast('Configuração salva ✅');
      reload();
    } catch (e) {
      toast(e.message);
    }
  };
  const msg = s.whatsapp_message.replaceAll('{nome}', 'Ana Lima').replaceAll('{viagem}', 'Itália dos sonhos').replaceAll('{codigo}', 'VG-2026-014').replaceAll('{destino}', 'Itália');
  return (
    <>
      <div className="page-head"><div><h1>Configurações</h1><p>Parâmetros que mudam o app sem precisar de programador.</p></div></div>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) 300px', alignItems: 'start' }}>
        <div className="card">
          <h2>WhatsApp e atendimento</h2>
          <div className="grid" style={{ gap: 14, marginTop: 14 }}>
            <div className="field"><label>Número oficial do WhatsApp</label><input className="input" value={s.whatsapp_number} onChange={(e) => setS({ ...s, whatsapp_number: e.target.value.replace(/\D/g, '') })} placeholder="5511999990000" /><span className="help">Só números, com DDI e DDD. Vazio = o botão de ajuda some do app.</span><ImpactTag>Botão verde flutuante e tela Ajuda</ImpactTag></div>
            <div className="field"><label>Mensagem pronta</label><textarea className="input" value={s.whatsapp_message} onChange={(e) => setS({ ...s, whatsapp_message: e.target.value })} /><span className="help">Variáveis: {'{nome}'} {'{viagem}'} {'{codigo}'} {'{destino}'}</span></div>
            <label className="row"><Toggle on={s.support_24h} onChange={(v) => setS({ ...s, support_24h: v })} label="Atendimento 24h" /> <span><b>Atendimento 24 horas</b><div className="small muted">Só ligue se houver equipe ou plantão cobrindo as 24 horas, todos os dias.</div></span></label>
            {!s.support_24h ? <div className="field"><label>Horário de atendimento</label><input className="input" value={s.support_hours_text} onChange={(e) => setS({ ...s, support_hours_text: e.target.value })} /><ImpactTag>Selo de horário na tela Ajuda</ImpactTag></div> : null}
            <div><Btn onClick={() => save(['whatsapp_number', 'whatsapp_message', 'support_24h', 'support_hours_text'])}>Salvar</Btn></div>
          </div>
        </div>
        <div>
          <div className="small strong muted" style={{ marginBottom: 8 }}>Prévia no WhatsApp</div>
          <div className="phone"><div className="phone-body" style={{ background: '#ece5dd' }}><div className="wa-bubble">{msg}</div><div className="small muted" style={{ textAlign: 'center' }}>{s.support_24h ? 'Atendimento 24 horas' : s.support_hours_text}</div></div></div>
        </div>
      </div>
      <div className="grid g2" style={{ marginTop: 18 }}>
        <div className="card">
          <h2>Prazos</h2>
          <div className="grid" style={{ gap: 14, marginTop: 14 }}>
            <div className="field"><label>Validade do convite (dias)</label><input className="input" type="number" value={s.invite_expiry_days} onChange={(e) => setS({ ...s, invite_expiry_days: Number(e.target.value) })} /></div>
            <div className="field"><label>Lembrete de tarefa (dias antes do prazo)</label><input className="input" type="number" value={s.reminder_days_before} onChange={(e) => setS({ ...s, reminder_days_before: Number(e.target.value) })} /><ImpactTag>Notificação e e-mail de lembrete</ImpactTag></div>
            <div className="field"><label>País de origem da agência</label><input className="input" value={s.home_country} onChange={(e) => setS({ ...s, home_country: e.target.value })} /><span className="help">Define o que é viagem "internacional" nas regras da jornada.</span></div>
            <div><Btn onClick={() => save(['invite_expiry_days', 'reminder_days_before', 'home_country'])}>Salvar</Btn></div>
          </div>
        </div>
        <div className="card">
          <h2>Categorias</h2>
          <p className="small muted" style={{ marginTop: 4 }}>Nomes que o viajante vê. A chave (em cinza) é a usada nas planilhas e não deve mudar.</p>
          {[['itinerary_categories', 'Roteiro'], ['document_categories', 'Documentos'], ['place_categories', 'Lugares']].map(([k, l]) => (
            <div key={k} style={{ marginTop: 14 }}>
              <div className="strong small">{l}</div>
              <div className="row wrap" style={{ marginTop: 6 }}>
                {s[k].map((c, i) => (
                  <span key={c.key} className="badge" style={{ padding: '2px 4px 2px 10px' }}>
                    <span className="muted mono">{c.key}</span>
                    <input className="input" style={{ padding: '2px 6px', width: 140, border: 0 }} value={c.label} onChange={(e) => setS({ ...s, [k]: s[k].map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
                  </span>
                ))}
              </div>
            </div>
          ))}
          <div style={{ marginTop: 14 }}><Btn onClick={() => save(['itinerary_categories', 'document_categories', 'place_categories'])}>Salvar categorias</Btn></div>
        </div>
      </div>
    </>
  );
}

export function TeamPage() {
  const toast = useToast();
  const { data, reload } = useData(() => api.users(), []);
  const [adding, setAdding] = useState(false);
  const team = (data?.users || []).filter((u) => u.role !== 'traveler');
  return (
    <>
      <div className="page-head"><div><h1>Equipe</h1><p>Quem pode usar o painel.</p></div><Btn icon="user-plus" onClick={() => setAdding(true)}>Adicionar pessoa</Btn></div>
      <HowTo steps={['Administrador: viagens, importação, configurações, equipe e tudo mais.', 'Editor de conteúdo: só destinos e lugares (não vê dados de clientes).', 'O acesso é por e-mail com código — sem senha para decorar. Desativar alguém encerra as sessões na hora.']} />
      <div className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead><tr><th>Pessoa</th><th>Perfil</th><th>Último acesso</th><th /></tr></thead>
          <tbody>
            {team.map((u) => (
              <tr key={u.id}>
                <td><b>{u.name}</b><div className="small muted">{u.email}</div></td>
                <td><Badge tone={u.role === 'admin' ? '' : 'soft-orange'}>{u.role === 'admin' ? 'Administrador' : 'Editor de conteúdo'}</Badge></td>
                <td className="small">{u.last_login_at ? fmtDateTime(u.last_login_at) : 'Nunca entrou'}</td>
                <td style={{ textAlign: 'right' }}>
                  <Btn sm variant="ghost" onClick={async () => { try { await api.updateUser(u.id, { role: u.role === 'admin' ? 'editor' : 'admin' }); reload(); } catch (e) { toast(e.message); } }}>Tornar {u.role === 'admin' ? 'editor' : 'admin'}</Btn>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {adding ? (
        <FormDrawer
          title="Adicionar pessoa da equipe"
          fields={[{ key: 'email', label: 'E-mail', required: true, type: 'email' }, { key: 'name', label: 'Nome' }, { key: 'role', label: 'Perfil', type: 'select', required: true, options: [{ key: 'admin', label: 'Administrador' }, { key: 'editor', label: 'Editor de conteúdo' }] }]}
          onSave={async (v) => { await api.saveUser(v); toast('Pessoa adicionada ✅'); reload(); }}
          onClose={() => setAdding(false)}
        />
      ) : null}
    </>
  );
}

export function AuditPage() {
  return (
    <>
      <div className="page-head"><div><h1>Histórico</h1><p>Toda alteração feita no painel ou por planilha: quem, o quê, quando, e o valor antes → depois.</p></div></div>
      <Audit />
    </>
  );
}

export function MetricsPage() {
  const m = useData(() => api.metrics(), []).data;
  if (!m) return <div className="empty">Carregando…</div>;
  const usage = Object.entries(m.usage);
  const max = Math.max(...usage.map(([, v]) => v), 1);
  const LABEL = { view_home: 'Início', view_itinerary: 'Roteiro', view_documents: 'Docs', view_guide: 'Explorar', open_map: 'Mapa', whatsapp_click: 'WhatsApp', view_tasks: 'Preparação', open_document: 'Abriu doc', view_place: 'Lugar' };
  return (
    <>
      <div className="page-head"><div><h1>Métricas do MVP</h1><p>Os indicadores do PRD §15, nos últimos {m.period_days} dias.</p></div></div>
      <div className="grid g4">
        <div className="card kpi"><div className="label">Ativação</div><div className="value">{m.activation.percent ?? '—'}%</div><div className="small muted">{m.activation.activated} de {m.activation.invited} convidados entraram</div></div>
        <div className="card kpi"><div className="label">Viagens completas</div><div className="value">{m.trips_essential_complete.percent}%</div><div className="small muted">dados essenciais preenchidos</div></div>
        <div className="card kpi"><div className="label">Tarefas feitas</div><div className="value">{m.tasks.percent}%</div><div className="small muted">{m.tasks.completed} de {m.tasks.expected}</div></div>
        <div className="card kpi"><div className="label">Favoritos salvos</div><div className="value">{m.favorites}</div><div className="small muted">no guia do destino</div></div>
      </div>
      <div className="grid g2" style={{ marginTop: 18 }}>
        <div className="card">
          <h2>Uso do app</h2>
          <div className="bar-chart" style={{ marginTop: 34 }}>
            {usage.map(([k, v], i) => (
              <div key={k} className={`bar ${k === 'whatsapp_click' ? 'alt' : ''}`} style={{ height: `${(v / max) * 100}%` }} title={`${LABEL[k] || k}: ${v}`}><span>{v}</span></div>
            ))}
          </div>
          <div className="row" style={{ gap: 10, marginTop: 8 }}>
            {usage.map(([k]) => <div key={k} className="small muted" style={{ flex: 1, textAlign: 'center' }}>{LABEL[k] || k}</div>)}
          </div>
        </div>
        <div className="card">
          <h2>Importações</h2>
          <div className="grid g2" style={{ marginTop: 14 }}>
            <div><div className="muted small">Concluídas</div><div className="kpi"><div className="value">{m.imports.completed}</div></div></div>
            <div><div className="muted small">Com erro na 1ª tentativa</div><div className="kpi"><div className="value">{m.imports.error_rate_percent ?? 0}%</div></div></div>
            <div style={{ gridColumn: '1/-1' }}><div className="muted small">Tempo médio da prévia à confirmação</div><div className="kpi"><div className="value">{m.imports.avg_minutes_preview_to_confirm ?? '—'} min</div></div></div>
          </div>
        </div>
      </div>
    </>
  );
}

export function PrivacyPage() {
  const { data, reload } = useData(() => api.privacyRequests(), []);
  const KIND = { access: 'Acesso aos dados', correction: 'Correção', deletion: 'Exclusão', other: 'Outro' };
  return (
    <>
      <div className="page-head"><div><h1>Pedidos LGPD</h1><p>Pedidos que os viajantes fazem pelo app (Perfil › Privacidade e dados).</p></div></div>
      <HowTo steps={['Responda pelo e-mail do titular e registre aqui o andamento.', 'Exclusão: confirme a identidade antes e verifique se há obrigação legal de guardar algo (ex.: fiscal).']} />
      <div className="card" style={{ padding: 0 }}>
        {(data?.requests || []).length ? (
          <table className="table">
            <thead><tr><th>Titular</th><th>Pedido</th><th>Mensagem</th><th>Situação</th></tr></thead>
            <tbody>
              {data.requests.map((p) => (
                <tr key={p.id}>
                  <td><b>{p.name}</b><div className="small muted">{p.email}</div></td>
                  <td>{KIND[p.kind]}</td>
                  <td className="small">{p.message}</td>
                  <td>
                    <select className="input" value={p.status} onChange={async (e) => { await api.updatePrivacy(p.id, e.target.value); reload(); }}>
                      <option value="open">Aberto</option><option value="in_progress">Em andamento</option><option value="resolved">Resolvido</option><option value="rejected">Recusado</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <Empty icon="shield-check" title="Nenhum pedido" />}
      </div>
    </>
  );
}

const GUIDE = [
  ['Viagens', 'suitcase-rolling', 'Crie a viagem (rascunho), associe viajantes, cadastre voos, hospedagens, roteiro e documentos. Publique e envie o convite.', 'Início, Roteiro, Docs e Preparação do viajante.'],
  ['Importar planilha', 'file-xls', 'Carga em lote pelo modelo oficial. Prévia com erros por linha/coluna antes de gravar; nada é apagado por faltar na planilha.', 'Atualiza o app na hora em que você confirma.'],
  ['Avisos', 'megaphone', 'Recado para uma ou várias viagens. "Essencial" vai por e-mail sempre.', 'Card no topo do Início + notificação.'],
  ['Destinos e Lugares', 'compass', 'Biblioteca reaproveitável. Tudo entra como pendente; só o que você publica aparece.', 'Explorar, página do lugar e "Inspire-se".'],
  ['Jornada de preparação', 'list-checks', 'Regras que geram tarefas com prazo automático em todas as viagens que combinam.', 'Aba Preparação e anel de progresso do Início.'],
  ['Configurações', 'gear-six', 'WhatsApp, mensagem pronta, horário de atendimento, categorias e prazos.', 'Botão de ajuda, rótulos e lembretes.'],
  ['Equipe', 'users', 'Administradores e editores de conteúdo. Acesso por e-mail com código.', '—'],
  ['Histórico', 'clock-counter-clockwise', 'Quem mudou o quê e quando, com antes → depois.', '—'],
];

export function GuidePage({ go }) {
  return (
    <>
      <div className="page-head"><div><h1>Como usar o painel</h1><p>O painel é a fonte de tudo que o viajante vê. Regra de ouro: o cliente não edita nada da viagem — a Vagari mantém tudo certinho por aqui.</p></div></div>
      <div className="grid g2">
        {GUIDE.map(([t, i, d, app]) => (
          <div key={t} className="card">
            <div className="row"><Icon name={i} size={28} weight="duotone" color="var(--purple600)" /><h2>{t}</h2></div>
            <p style={{ marginTop: 10 }}>{d}</p>
            {app !== '—' ? <div style={{ marginTop: 10 }}><ImpactTag>{app}</ImpactTag></div> : null}
          </div>
        ))}
      </div>
      <div className="card soft" style={{ marginTop: 18 }}>
        <h2>Fluxo de uma viagem nova</h2>
        <ol style={{ marginTop: 10, display: 'grid', gap: 6 }}>
          <li>Viagens › Nova viagem (ou Importar planilha).</li>
          <li>Preencha as abas até o Resumo mostrar "Tudo certo".</li>
          <li>Publicar viagem → Viajantes › Enviar convite.</li>
          <li>Indique 3 a 5 lugares em "Destaques do guia" com um recado seu.</li>
          <li>Mudou algo? Edite e marque "Avisar viajantes" se for importante.</li>
        </ol>
        <div style={{ marginTop: 14 }}><Btn icon="arrow-right" onClick={() => go('viagens')}>Ir para Viagens</Btn></div>
      </div>
    </>
  );
}

export function LoginPage({ onDone }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState(1);
  const [err, setErr] = useState(null);
  const go = async (e) => {
    e.preventDefault();
    setErr(null);
    try {
      if (step === 1) { await api.requestCode(email); setStep(2); }
      else { await api.verifyCode(email, code); onDone(); }
    } catch (x) { setErr(x.message); }
  };
  return (
    <div style={{ minHeight: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
      <div style={{ background: 'linear-gradient(160deg, var(--purple500), var(--purple800))', color: '#fff', padding: 48, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div className="logo" style={{ fontSize: 40, padding: 0 }}>vagari<i /></div>
        <div>
          <h1 style={{ fontSize: 44 }}>Painel da equipe</h1>
          <p style={{ opacity: 0.85, marginTop: 10, maxWidth: 420 }}>Aqui você monta e atualiza tudo que o viajante vê no app. Sem integrações, sem complicação.</p>
        </div>
        <div className="small" style={{ opacity: 0.7 }}>Acesso restrito à equipe Vagari.</div>
      </div>
      <form onSubmit={go} style={{ padding: 48, display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: 460, gap: 14 }}>
        <h2>{step === 1 ? 'Entrar' : 'Digite o código'}</h2>
        <p className="muted">{step === 1 ? 'Sem senha: mandamos um código para o seu e-mail.' : `Enviamos 6 números para ${email}.`}</p>
        {step === 1 ? <input className="input" type="email" placeholder="voce@vagari.com.br" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus /> : <input className="input" inputMode="numeric" placeholder="000000" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} autoFocus style={{ fontSize: 24, letterSpacing: 8, textAlign: 'center' }} />}
        {err ? <div className="small" style={{ color: 'var(--danger)' }}>{err}</div> : null}
        <button className="btn" type="submit">{step === 1 ? 'Receber código' : 'Entrar'}</button>
        {api.demo ? <p className="small muted">Prévia: use qualquer e-mail e qualquer código de 6 números.</p> : null}
      </form>
    </div>
  );
}
