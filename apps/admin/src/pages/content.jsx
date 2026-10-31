/** Biblioteca de conteúdo: destinos, revisão de lugares e pesquisa com o Claude. */
import React, { useState } from 'react';
import { api } from '../api.js';
import { FormDrawer } from '../form.jsx';
import { Badge, Btn, Cover, Empty, HowTo, Icon, Impact, StatusBadge, useToast } from '../ui.jsx';
import { DESTINATIONS, destinationName } from '@shared/library.js';
import { useData } from './common.jsx';

const CATS = [['ponto_turistico', 'Pontos turísticos'], ['museu_cultura', 'Museus e cultura'], ['restaurante', 'Restaurantes'], ['cafe', 'Cafés'], ['bar', 'Bares'], ['experiencia', 'Experiências'], ['compras', 'Compras'], ['servicos', 'Serviços úteis']].map(([key, label]) => ({ key, label }));
const destLabel = (id) => destinationName(DESTINATIONS.find((d) => d.id === id)) || id;

export function DestinationsPage({ go }) {
  const { data, reload } = useData(() => api.destinations(), []);
  const [editing, setEditing] = useState(null);
  const toast = useToast();
  const cities = (data?.destinations || []).filter((d) => d.city || !DESTINATIONS.some((x) => x.parent === d.id));
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Destinos</h1>
          <p>A biblioteca é reaproveitada em todas as viagens: cadastre um destino uma vez e use sempre.</p>
        </div>
        <div className="row">
          <Btn variant="secondary" icon="lightbulb" onClick={() => go('pesquisar')}>Pesquisar cidade com o Claude</Btn>
          <Btn icon="plus-circle" onClick={() => setEditing({})}>Novo destino</Btn>
        </div>
      </div>
      <HowTo steps={['Países, regiões, cidades e bairros. Use "destino pai" para montar a hierarquia (ex.: roma → italia).', 'O destino de uma viagem define a capa e o que aparece no Explorar (o destino e todos os "filhos" dele).', 'Fotos: até a carga oficial de fotos, o app mostra uma capa ilustrada com as cores do destino.']} />
      <Impact where="Explorar e Início">Apresentação, melhor época e lugares do destino aparecem no Explorar e na vitrine "Inspire-se pra próxima".</Impact>
      <div className="grid g4" style={{ marginTop: 18 }}>
        {cities.map((d) => (
          <div key={d.id} className="card" style={{ padding: 0, overflow: 'hidden', cursor: 'pointer' }} onClick={() => setEditing(d)}>
            <Cover art={DESTINATIONS.find((x) => x.id === d.id)?.art} height={140} style={{ borderRadius: 0 }}>
              <span className="small" style={{ opacity: 0.85 }}>{d.country}</span>
              <h2>{d.name}</h2>
            </Cover>
            <div style={{ padding: 12 }} className="row small">
              <Badge tone="green">{d.approved} publicados</Badge>
              {d.places - d.approved > 0 ? <Badge tone="yellow">{d.places - d.approved} p/ revisar</Badge> : null}
            </div>
          </div>
        ))}
      </div>
      {editing ? (
        <FormDrawer
          title={editing.id ? `Editar ${editing.name}` : 'Novo destino'}
          impact="Texto e melhor época aparecem na página do destino e no Explorar."
          impactWhere="Explorar"
          initial={editing.id ? { destination_id: editing.id, country: editing.country, region: editing.region, city: editing.city, parent_id: editing.parent_id, timezone: editing.timezone, overview: editing.overview, best_season: editing.best_season } : {}}
          fields={[
            { key: 'destination_id', label: 'ID do destino', required: true, disabled: !!editing.id, placeholder: 'cartagena', help: 'Sem espaços nem acentos. Não muda depois.' },
            { row: [{ key: 'country', label: 'País', required: true }, { key: 'city', label: 'Cidade' }] },
            { row: [{ key: 'region', label: 'Região/estado' }, { key: 'parent_id', label: 'Destino pai', type: 'select', options: DESTINATIONS.filter((d) => !d.city).map((d) => ({ key: d.id, label: d.country })) }] },
            { key: 'timezone', label: 'Fuso horário', placeholder: 'America/Bogota', help: 'Nome IANA. Vira o padrão das viagens para cá.' },
            { key: 'overview', label: 'Apresentação', type: 'textarea', impact: 'Texto da página do destino' },
            { key: 'best_season', label: 'Melhor época', impact: 'Card "Melhor época"' },
          ]}
          onSave={async (v) => { await api.saveDestination(editing.id || null, v); toast('Destino salvo ✅'); reload(); }}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}

export function PlacesPage() {
  const toast = useToast();
  const [status, setStatus] = useState('pending_review');
  const [dest, setDest] = useState('');
  const [q, setQ] = useState('');
  const { data, reload } = useData(() => api.places(Object.fromEntries(Object.entries({ status, destination_id: dest, q }).filter(([, v]) => v))), [status, dest, q]);
  const [sel, setSel] = useState(new Set());
  const [editing, setEditing] = useState(null);
  const places = data?.places || [];
  const counts = data?.counts || {};
  const review = async (action) => {
    const r = await api.reviewPlaces([...sel], action);
    toast(`${r.changed.length} atualizado(s)${r.blocked.length ? ` · ${r.blocked.length} bloqueado(s): ${r.blocked[0].reason}` : ''}`);
    setSel(new Set());
    reload();
  };
  const all = places.length && places.every((p) => sel.has(p.id));
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Lugares</h1>
          <p>Pontos turísticos, museus, restaurantes e experiências. Só os <b>publicados</b> aparecem no app.</p>
        </div>
        <Btn icon="plus-circle" onClick={() => setEditing({})}>Novo lugar</Btn>
      </div>
      <HowTo
        open={status === 'pending_review'}
        title="Como revisar"
        steps={[
          'Tudo que chega por planilha (inclusive a pesquisa do Claude) entra como "Pendente de revisão".',
          'Confira nome, endereço, link oficial e se o lugar ainda funciona. Horário e preço só com fonte oficial.',
          'Marque os itens e clique em Publicar. Para tirar do app sem apagar o histórico, use Arquivar.',
          'Editar um lugar publicado faz ele voltar para revisão (sai do app até ser aprovado de novo).',
        ]}
      />
      <div className="tabs">
        {[['pending_review', 'Pendentes'], ['approved', 'Publicados'], ['archived', 'Arquivados']].map(([k, l]) => (
          <button key={k} className={`tab ${status === k ? 'active' : ''}`} onClick={() => { setStatus(k); setSel(new Set()); }}>{l} <span className="n">{counts[k] || 0}</span></button>
        ))}
      </div>
      <div className="row wrap" style={{ marginBottom: 14 }}>
        <input className="input" style={{ maxWidth: 280 }} placeholder="Buscar lugar…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" style={{ maxWidth: 240 }} value={dest} onChange={(e) => setDest(e.target.value)}>
          <option value="">Todos os destinos</option>
          {DESTINATIONS.filter((d) => d.city).map((d) => <option key={d.id} value={d.id}>{d.city}</option>)}
        </select>
        <span className="grow" />
        {sel.size ? (
          <>
            <span className="small strong">{sel.size} selecionado(s)</span>
            {status !== 'approved' ? <Btn sm icon="check-circle" onClick={() => review('approve')}>Publicar</Btn> : null}
            {status !== 'archived' ? <Btn sm variant="secondary" icon="x-circle" onClick={() => review('archive')}>Arquivar</Btn> : null}
            {status !== 'pending_review' ? <Btn sm variant="ghost" onClick={() => review('reject')}>Voltar p/ revisão</Btn> : null}
          </>
        ) : null}
      </div>
      <div className="card" style={{ padding: 0 }}>
        {places.length ? (
          <table className="table">
            <thead><tr><th style={{ width: 40 }}><input type="checkbox" checked={!!all} onChange={() => setSel(all ? new Set() : new Set(places.map((p) => p.id)))} aria-label="Selecionar todos" /></th><th>Lugar</th><th>Destino</th><th>Categoria</th><th>Verificação</th><th>Situação</th></tr></thead>
            <tbody>
              {places.map((p) => (
                <tr key={p.id} className="click" onClick={() => setEditing(p)}>
                  <td onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={sel.has(p.id)} onChange={() => { const s = new Set(sel); s.has(p.id) ? s.delete(p.id) : s.add(p.id); setSel(s); }} aria-label={`Selecionar ${p.name}`} /></td>
                  <td><div className="strong">{p.name}</div><div className="small muted">{p.address || 'sem endereço'}</div></td>
                  <td>{destLabel(p.destination_id)}</td>
                  <td>{CATS.find((c) => c.key === p.category)?.label}</td>
                  <td className="small">{p.official_url ? <Badge tone="green" icon="link">site oficial</Badge> : <Badge tone="yellow">sem site oficial</Badge>}{p.verification_notes ? <div className="muted" style={{ maxWidth: 260 }}>{p.verification_notes}</div> : null}</td>
                  <td><StatusBadge status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <Empty icon="check-circle" title="Nada por aqui">{status === 'pending_review' ? 'Fila de revisão zerada! 🎉' : ''}</Empty>}
      </div>
      {editing ? (
        <FormDrawer
          title={editing.id ? editing.name : 'Novo lugar'}
          subtitle={editing.id ? `ID ${editing.id}` : 'Entra como pendente de revisão.'}
          impact={editing.status === 'approved' ? 'Este lugar está publicado. Se você mudar o conteúdo, ele volta para revisão e sai do app até ser aprovado de novo.' : 'Depois de publicado, aparece no Explorar das viagens deste destino.'}
          impactWhere="Explorar"
          initial={editing.id ? { content_id: editing.id, destination_id: editing.destination_id, name: editing.name, category: editing.category, short_description: editing.short_description, address: editing.address, official_url: editing.official_url } : {}}
          fields={[
            { row: [{ key: 'content_id', label: 'ID', required: true, disabled: !!editing.id, placeholder: 'roma-coliseu' }, { key: 'destination_id', label: 'Destino', required: true, type: 'select', options: DESTINATIONS.filter((d) => d.city).map((d) => ({ key: d.id, label: d.city })) }] },
            { key: 'name', label: 'Nome', required: true },
            { key: 'category', label: 'Categoria', type: 'select', required: true, options: CATS, impact: 'Filtro de categoria' },
            { key: 'short_description', label: 'Descrição (até 350 caracteres)', type: 'textarea', help: 'Texto original, no tom Vagari.', impact: 'Texto da página do lugar' },
            { key: 'address', label: 'Endereço', required: true, impact: 'Botão "Abrir no mapa"' },
            { key: 'official_url', label: 'Site oficial', type: 'url', impact: 'Botão "Site oficial"' },
          ]}
          onSave={async (v) => {
            const r = await api.savePlace(editing.id || null, v);
            toast(r.warnings?.[0]?.message || 'Salvo ✅');
            reload();
          }}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}

export function ResearchPage() {
  const toast = useToast();
  const [form, setForm] = useState({ city: 'Cartagena', country: 'Colômbia', destination_id: 'cartagena' });
  const [prompt, setPrompt] = useState(null);
  const gen = async () => setPrompt((await api.researchPrompt(form)).prompt);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Pesquisar cidade com o Claude</h1>
          <p>Gera o prompt-base (PRD §7.4) já com as colunas exatas da aba PLACES e as suas categorias. O resultado volta por importação e entra como pendente de revisão.</p>
        </div>
      </div>
      <HowTo
        open
        steps={['Preencha cidade, país e o ID do destino (cadastre o destino antes, se for novo).', 'Gere o prompt e cole no Claude. Peça a resposta em CSV separado por ponto e vírgula.', 'Salve como PLACES.csv e importe em "Importar planilha" › Conteúdo.', 'Revise os itens em Lugares › Pendentes e publique os aprovados.']}
      />
      <div className="card">
        <div className="grid g3">
          {[['city', 'Cidade'], ['country', 'País'], ['destination_id', 'ID do destino']].map(([k, l]) => (
            <div key={k} className="field"><label>{l}</label><input className="input" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></div>
          ))}
        </div>
        <div style={{ marginTop: 14 }}><Btn icon="lightbulb" onClick={gen}>Gerar prompt</Btn></div>
        {prompt ? (
          <>
            <pre className="prompt" style={{ marginTop: 16 }}>{prompt}</pre>
            <Btn variant="secondary" icon="copy" onClick={() => navigator.clipboard?.writeText(prompt).then(() => toast('Prompt copiado'), () => toast('Selecione e copie manualmente'))}>Copiar prompt</Btn>
          </>
        ) : null}
      </div>
    </>
  );
}
