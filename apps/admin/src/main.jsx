import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { api } from './api.js';
import { Icon, ToastProvider } from './ui.jsx';
import { TripsPage, TripPage } from './pages/trips.jsx';
import { ImportPage } from './pages/import.jsx';
import { DestinationsPage, PlacesPage, ResearchPage } from './pages/content.jsx';
import { AuditPage, BroadcastPage, DashboardPage, GuidePage, LoginPage, MetricsPage, PrivacyPage, RulesPage, SettingsPage, TeamPage } from './pages/system.jsx';

const NAV = [
  ['Operação', [
    ['inicio', 'Início', 'house'],
    ['viagens', 'Viagens', 'suitcase-rolling'],
    ['importar', 'Importar planilha', 'file-xls'],
    ['avisos', 'Avisos em grupo', 'megaphone'],
  ]],
  ['Conteúdo', [
    ['destinos', 'Destinos', 'globe-hemisphere-west'],
    ['lugares', 'Lugares', 'map-pin-simple'],
    ['pesquisar', 'Pesquisar com o Claude', 'lightbulb'],
  ]],
  ['Configuração', [
    ['jornada', 'Jornada de preparação', 'list-checks'],
    ['configuracoes', 'Configurações', 'gear-six'],
    ['equipe', 'Equipe', 'users'],
  ]],
  ['Acompanhamento', [
    ['metricas', 'Métricas', 'chart-bar'],
    ['historico', 'Histórico', 'clock-counter-clockwise'],
    ['lgpd', 'Pedidos LGPD', 'shield-check'],
    ['guia', 'Como usar o painel', 'book-open'],
  ]],
];

// Rotas por "#nome" (funciona em qualquer hospedagem e na prévia).
const readHash = () => (location.hash || '#inicio').slice(1) || 'inicio';

function App() {
  const [route, setRoute] = useState(readHash());
  const [user, setUser] = useState(null);
  const [checked, setChecked] = useState(false);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const on = () => setRoute(readHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  useEffect(() => {
    // Na prévia o painel já abre logado (a tela de login fica em #login).
    api.me().then((r) => setUser(r.user), () => {}).finally(() => setChecked(true));
  }, []);
  useEffect(() => {
    if (user) api.places({ status: 'pending_review' }).then((r) => setPending(r.counts?.pending_review || 0), () => {});
  }, [user, route]);

  const go = (r) => {
    location.hash = r;
    window.scrollTo(0, 0);
  };
  if (!checked) return null;
  if (!user || (api.demo && route === 'login')) return <LoginPage onDone={() => api.me().then((r) => { setUser(r.user); go('inicio'); })} />;

  const page = route.startsWith('viagem-') ? <TripPage key={route} tripId={route.slice(7)} go={go} /> : {
    inicio: <DashboardPage go={go} user={user} />,
    viagens: <TripsPage go={go} />,
    importar: <ImportPage />,
    avisos: <BroadcastPage />,
    destinos: <DestinationsPage go={go} />,
    lugares: <PlacesPage />,
    pesquisar: <ResearchPage />,
    jornada: <RulesPage />,
    configuracoes: <SettingsPage />,
    equipe: <TeamPage />,
    metricas: <MetricsPage />,
    historico: <AuditPage />,
    lgpd: <PrivacyPage />,
    guia: <GuidePage go={go} />,
  }[route] || <DashboardPage go={go} user={user} />;
  const active = route.startsWith('viagem-') ? 'viagens' : route;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="logo">vagari<i /></div>
        <div className="logo-sub">Painel da equipe</div>
        {NAV.map(([group, items]) => (
          <React.Fragment key={group}>
            <div className="nav-group">{group}</div>
            {items.map(([k, l, i]) => (
              <button key={k} className={`nav-item ${active === k ? 'active' : ''}`} onClick={() => go(k)} aria-current={active === k ? 'page' : undefined}>
                <Icon name={i} size={20} weight={active === k ? 'duotone' : 'regular'} />
                {l}
                {k === 'lugares' && pending ? <span className="count">{pending}</span> : null}
              </button>
            ))}
          </React.Fragment>
        ))}
        <div className="sidebar-foot">
          <div className="strong">{user.name}</div>
          <div>{user.email}</div>
        </div>
      </aside>
      <main className="main">
        {api.demo ? <div className="demo-banner">PRÉVIA COM DADOS FICTÍCIOS — nada aqui é real e as alterações somem ao recarregar.</div> : null}
        <div className="content">{page}</div>
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <ToastProvider>
    <App />
  </ToastProvider>,
);
