/**
 * Gera preview/index.html: a vitrine da prévia (app num celular, painel e design system).
 * Uso: node scripts/build-showroom.mjs
 */
import fs from 'node:fs';
import { colors } from '../shared/tokens.js';
import { LOGO, AVATARS } from '../shared/brand.js';
import { DESTINATIONS, PLACES } from '../shared/library.js';

const fontB64 = (f) => fs.readFileSync(`brand/fonts/${f}.otf`).toString('base64');
const logoSvg = (w, word = '#fff') => `<svg viewBox="${LOGO.fullBox.join(' ')}" width="${w}" role="img" aria-label="Vagari"><path d="${LOGO.word}" fill="${word}"/><path d="${LOGO.v}" fill="${word}"/><path d="${LOGO.star}" fill="${LOGO.orange}"/></svg>`;
const ICONS = JSON.parse(fs.readFileSync('shared/icons.json', 'utf8'));
const svg = (name, size = 28, weight = 'duotone', color = colors.purple600) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${(ICONS[name][weight] || ICONS[name].regular)
    .map((e) => `<path d="${e.d}" fill="${e.a ? colors.orange500 : color}"${e.fr ? ` fill-rule="${e.fr}"` : ''}/>`)
    .join('')}</svg>`;

const swatches = [
  ['Roxo principal', colors.purple600, '#fff'],
  ['Roxo vibrante', colors.purple500, '#fff'],
  ['Roxo vinho', colors.purple700, '#fff'],
  ['Roxo mais escuro', colors.purple800, '#fff'],
  ['Laranja principal', colors.orange500, colors.ink],
  ['Off-white · fundo', colors.bg, colors.ink],
  ['Branco', '#FFFFFF', colors.ink],
  ['Tons de apoio (roxo 50)', colors.purple50, colors.ink],
  ['Tons de apoio (roxo 100)', colors.purple100, colors.ink],
  ['Sucesso', colors.success, '#fff'],
  ['Atenção', colors.warning, '#fff'],
  ['Erro', colors.danger, '#fff'],
];
const iconNames = ['house', 'map-trifold', 'compass', 'list-checks', 'files', 'airplane-tilt', 'bed', 'suitcase-rolling', 'map-pin-simple', 'calendar', 'clock', 'heart', 'bell', 'megaphone', 'seal-check', 'chat-teardrop-dots', 'fork-knife', 'coffee', 'bank', 'castle-turret', 'church', 'sun', 'snowflake', 'waves', 'boat', 'bus', 'car', 'camera', 'shopping-bag', 'confetti', 'first-aid-kit', 'receipt', 'shield-check', 'lightbulb', 'globe-hemisphere-west', 'user-circle'];
const cities = DESTINATIONS.filter((d) => d.tagline && (d.city || !DESTINATIONS.some((c) => c.parent === d.id)));
const photos = [...new Set([...DESTINATIONS.map((d) => d.photo), ...PLACES.map((p) => p.photo)].filter(Boolean))];

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Vagari — prévia do app e do painel</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
<style>
  @font-face { font-family: 'Neulis'; font-weight: 700; src: url(data:font/otf;base64,${fontB64('Neulis-Bold')}) format('opentype'); }
  @font-face { font-family: 'NeulisAlt'; font-weight: 700; src: url(data:font/otf;base64,${fontB64('NeulisAlt-Bold')}) format('opentype'); }
  @font-face { font-family: 'Neulis'; font-weight: 600; src: url(data:font/otf;base64,${fontB64('Neulis-SemiBold')}) format('opentype'); }
  :root { --p6:${colors.purple600}; --p7:${colors.purple700}; --p5:${colors.purple500}; --p50:${colors.purple50}; --p100:${colors.purple100}; --o5:${colors.orange500}; --o50:${colors.orange50}; --ink:${colors.ink}; --muted:${colors.muted}; --bg:${colors.bg}; --line:${colors.line}; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Plus Jakarta Sans', system-ui, sans-serif; color: var(--ink); background: var(--bg); }
  h1 { font-family: 'Neulis', system-ui, sans-serif; } h2, h3 { font-family: 'NeulisAlt', 'Neulis', system-ui, sans-serif; margin: 0; letter-spacing: -0.02em; }
  header { background: linear-gradient(135deg, var(--p5), var(--p7)); color: #fff; padding: 22px 32px 0; }
  .top { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
  .logo { display: flex; }
  .sub { opacity: .85; font-size: 14px; }
  nav { display: flex; gap: 6px; margin-top: 18px; flex-wrap: wrap; }
  nav a { color: #fff; text-decoration: none; font-weight: 700; padding: 12px 18px; border-radius: 16px 16px 0 0; opacity: .85; }
  nav a.on { background: var(--bg); color: var(--p7); opacity: 1; }
  main { padding: 28px 32px 60px; max-width: 1480px; margin: 0 auto; }
  section { display: none; } section.on { display: block; }
  .app-wrap { display: grid; grid-template-columns: auto 1fr; gap: 40px; align-items: start; }
  .phone { width: 410px; height: 860px; border-radius: 56px; background: #111; padding: 12px; box-shadow: 0 30px 80px rgba(75, 19, 75,.35); position: relative; }
  .phone iframe { width: 100%; height: 100%; border: 0; border-radius: 46px; background: #fff; }
  .notch { position: absolute; top: 22px; left: 50%; transform: translateX(-50%); width: 110px; height: 30px; border-radius: 20px; background: #111; z-index: 2; pointer-events: none; }
  .card { background: #fff; border-radius: 20px; padding: 20px; box-shadow: 0 8px 24px rgba(75, 19, 75,.08); }
  .grid { display: grid; gap: 16px; } .g2 { grid-template-columns: 1fr 1fr; } .g3 { grid-template-columns: repeat(3,1fr); } .g6 { grid-template-columns: repeat(6,1fr); }
  @media (max-width: 1100px) { .app-wrap { grid-template-columns: 1fr; justify-items: center; } .g6 { grid-template-columns: repeat(3,1fr); } .g3, .g2 { grid-template-columns: 1fr; } }
  ul.steps { margin: 10px 0 0; padding-left: 20px; display: grid; gap: 6px; color: #5B4558; }
  .tag { display: inline-block; background: var(--o5); color: var(--ink); border-radius: 99px; padding: 3px 10px; font-size: 12px; font-weight: 800; }
  .tag.soft { background: var(--p50); color: var(--p7); }
  .btn { display: inline-flex; gap: 8px; align-items: center; background: var(--p6); color: #fff; text-decoration: none; padding: 10px 18px; border-radius: 99px; font-weight: 700; }
  .btn.sec { background: var(--p50); color: var(--p7); }
  .admin-frame { width: 100%; height: 860px; border: 0; border-radius: 20px; box-shadow: 0 20px 60px rgba(75, 19, 75,.18); background: #fff; }
  .sw { border-radius: 16px; padding: 14px; height: 96px; display: flex; flex-direction: column; justify-content: flex-end; font-size: 12px; font-weight: 700; border: 1px solid var(--line); }
  .icons { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 10px; }
  .icons div { background: #fff; border-radius: 14px; padding: 12px 6px; text-align: center; font-size: 11px; color: var(--muted); }
  .dest { border-radius: 18px; height: 130px; padding: 14px; color: #fff; display: flex; flex-direction: column; justify-content: flex-end; position: relative; overflow: hidden; }
  .dest::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(42, 2, 32,0) 30%, rgba(42, 2, 32,.75)); }
  .dest > * { position: relative; z-index: 1; } .dest svg { position: absolute; right: 8px; top: 8px; opacity: .22; z-index: 0; }
  .muted { color: var(--muted); } .small { font-size: 13px; }
  .note { background: var(--o50); border-radius: 16px; padding: 14px 16px; font-size: 14px; }
  code { background: var(--p50); padding: 1px 6px; border-radius: 6px; font-size: 12.5px; }
  .btn-row { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 14px; }
</style>
</head>
<body>
<header>
  <div class="top">
    <div class="logo">${logoSvg(150)}</div>
    <div class="sub">Prévia do MVP · app do viajante (iOS/Android) e painel da equipe · dados fictícios</div>
  </div>
  <nav>
    <a href="#app" data-s="app">📱 App do viajante</a>
    <a href="#painel" data-s="painel">🧭 Painel da equipe</a>
    <a href="#design" data-s="design">🎨 Design system</a>
    <a href="#notas" data-s="notas">📝 O que falta / provisório</a>
  </nav>
</header>
<main>
  <section id="s-app">
    <div class="app-wrap">
      <div class="phone"><div class="notch"></div><iframe src="app/index.html" title="App Vagari (prévia)"></iframe></div>
      <div class="grid">
        <div class="card">
          <span class="tag">Prévia navegável</span>
          <h2 style="margin-top:10px">Como testar o app</h2>
          <ul class="steps">
            <li><b>Abertura e apresentação</b> → toque em <b>Pular</b> ou avance os 3 slides.</li>
            <li><b>Login simples</b>: Apple, Google ou e-mail. No e-mail, qualquer código de 6 números entra. Também dá pra simular o <b>link de convite</b> (um toque e pronto).</li>
            <li><b>Início</b>: capa grande, contagem regressiva, preparação, avisos, próximo voo, hotel, próximos rolês e dicas.</li>
            <li><b>Roteiro</b> dia a dia, <b>Explorar</b> (indicações da Vagari, perto do hotel, favoritos, inspiração), <b>Preparação</b> (marca as tarefas!) e <b>Docs</b>.</li>
            <li>Botão verde = <b>falar com a Vagari no WhatsApp</b>, com a mensagem já preenchida.</li>
            <li>No <b>Perfil</b> (bolinha laranja no topo do Início) tem o <b>modo demonstração</b>: veja o app “a 2 dias do embarque”, “durante a viagem” ou “sem viagem”.</li>
          </ul>
          <div class="btn-row"><a class="btn" href="app/index.html" target="_blank" rel="noopener">Abrir o app em tela cheia</a></div>
        </div>
        <div class="card">
          <h3>Telas do app</h3>
          <p class="small muted" style="margin-top:6px">Abertura · Apresentação (3) · Login (Apple, Google, e-mail) · Código · Convite · Interesses · Início · Trocar viagem · Notificações · Roteiro · Voo · Hospedagem · Atividade · Explorar · Lugar · Favoritos · Destino (inspiração) · Preparação · Tarefa · Docs · Visualizar documento · Perfil · Meus interesses · Notificações (preferências) · Privacidade e dados · Ajuda/WhatsApp · Estados vazios.</p>
        </div>
        <div class="note">📷 <b>Fotos</b>: este ambiente não conseguiu baixar imagens (Wikimedia e Behance bloqueados na rede). Por isso as capas estão <b>ilustradas</b> com as cores de cada destino. O app já está pronto pra receber as fotos reais: é só liberar o acesso ou mandar os arquivos (lista em <code>docs/FOTOS.md</code>).</div>
      </div>
    </div>
  </section>

  <section id="s-painel">
    <div class="card" style="margin-bottom:16px; display:flex; gap:16px; align-items:center; flex-wrap:wrap">
      <div style="flex:1; min-width:280px">
        <h2>Painel da equipe Vagari</h2>
        <p class="muted small" style="margin-top:6px">Mesma identidade do app. Cada tela tem “Como usar esta tela” e os selos laranja <b>“No app: …”</b> mostram o que muda pro viajante quando você altera aquele campo. Dica: abra a viagem <b>Itália dos sonhos</b>, teste <b>Importar planilha › Ver prévia</b> e <b>Configurações</b> (prévia da mensagem do WhatsApp).</p>
      </div>
      <a class="btn" href="painel/index.html" target="_blank" rel="noopener">Abrir o painel em tela cheia</a>
      <a class="btn sec" href="painel/index.html#login" target="_blank" rel="noopener">Ver tela de login</a>
    </div>
    <iframe class="admin-frame" src="painel/index.html" title="Painel Vagari (prévia)"></iframe>
  </section>

  <section id="s-design">
    <div class="grid g2" style="align-items:start">
      <div class="card">
        <h2>Cores</h2>
        <p class="muted small" style="margin:6px 0 14px">Paleta oficial da Vagari. Roxo predominante, app claro (off-white), laranja só nos destaques (contagem regressiva, “Indicação Vagari”, acentos dos ícones). Os tons de apoio e de estado (sucesso, atenção, erro) foram derivados para uso em telas.</p>
        <div class="grid g3">${swatches.map(([n, c, fg]) => `<div class="sw" style="background:${c};color:${fg}">${n}<span style="opacity:.75;font-weight:600">${c}</span></div>`).join('')}</div>
      </div>
      <div class="card">
        <h2>Tipografia</h2>
        <div style="margin-top:14px; display:grid; gap:14px">
          <div><div class="muted small">H1 · Neulis Bold (fonte oficial)</div><div style="font-family:'Neulis';font-weight:700;font-size:40px;letter-spacing:-1px">Itália dos sonhos</div></div>
          <div><div class="muted small">H2/H3 · NeulisAlt (letras mais limpas)</div><div style="font-family:'NeulisAlt';font-weight:700;font-size:24px">Próximos rolês</div></div>
          <div><div class="muted small">Texto · Plus Jakarta Sans</div><div style="font-size:16px">Vai fazer uns 8 a 14 °C. Leva casaco, tênis confortável e o adaptador de tomada.</div></div>
          <div><div class="muted small">Tom de voz</div><div style="font-size:15px">“E aí, bora entrar? ✈️” · “Tá quase lá!” · “Mandou bem! ✅” · “Dia livre! ☀️” · “Chama a gente!”</div></div>
        </div>
      </div>
    </div>
    <div class="card" style="margin-top:16px">
      <h2>Iconografia · Lucevias (MIT)</h2>
      <p class="muted small" style="margin:6px 0 14px">Peso duotone com acento laranja nas telas; regular nos estados inativos. 123 ícones já empacotados no app e no painel.</p>
      <div class="icons">${iconNames.map((n) => `<div>${svg(n)}<div>${n}</div></div>`).join('')}</div>
    </div>
    <div class="card" style="margin-top:16px">
      <h2>Carinhas · avatares do perfil</h2>
      <p class="muted small" style="margin:6px 0 14px">Do arquivo Faces.svg: ${AVATARS.length} avatares. O viajante escolhe a dele no Perfil; no painel, cada pessoa recebe uma automaticamente.</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:10px">${AVATARS.map((a) => `<div style="width:72px">${a.xml.replace('<svg ', '<svg width="72" height="72" ')}</div>`).join('')}</div>
    </div>
    <div class="card" style="margin-top:16px">
      <h2>Biblioteca inicial de destinos (${cities.length} destinos · ${PLACES.length} lugares)</h2>
      <p class="muted small" style="margin:6px 0 14px">A partir da sua lista. Tudo entra como <b>pendente de revisão</b> (planilha em <code>content/biblioteca-inicial.xlsx</code>).</p>
      <div class="grid g6">${cities.map((d) => `<div class="dest" style="background:linear-gradient(135deg,${d.art.colors[0]},${d.art.colors[1]})">${svg(d.art.icon, 90, 'duotone', '#fff')}<span class="small" style="opacity:.85">${d.country}</span><h3>${d.city || d.country}</h3></div>`).join('')}</div>
    </div>
  </section>

  <section id="s-notas">
    <div class="grid g2" style="align-items:start">
      <div class="card">
        <h2>O que é provisório</h2>
        <ul class="steps">
          <li><b>Cores, logo e Neulis</b>: já aplicados com os arquivos que você enviou. Tons de apoio (roxos claros, estados) foram derivados da paleta — confirme se quiser outros.</li>
          <li><b>Logo</b>: o arquivo traz o roxo <code>#5C1C59</code> e o laranja <code>#E2801F</code>, levemente diferentes da lista de cores (<code>#4B134B</code> e <code>#F77A10</code>). Usei o logo exatamente como veio; me diga se prefere recolorir para a paleta.</li>
          <li><b>Fotos</b>: ainda não consegui acessar a pasta Fotos do seu computador, então as capas seguem ilustradas. O app está pronto para receber as fotos (${photos.length} pontos mapeados).</li>
          <li><b>Login com Apple/Google</b>: telas prontas; a ligação real entra na etapa de publicação (precisa das contas de desenvolvedor).</li>
        </ul>
      </div>
      <div class="card">
        <h2>Como foi construído</h2>
        <ul class="steps">
          <li><b>App</b>: Expo / React Native — um código só para iOS e Android, pronto pra publicar nas lojas (EAS). Esta prévia é o mesmo código rodando no navegador.</li>
          <li><b>Painel</b>: React (web), servido pelo mesmo servidor da API.</li>
          <li><b>Backend</b>: o que já estava pronto (importação, permissões, histórico, 41 testes). App e painel usam as mesmas rotas.</li>
          <li><b>Dados</b>: tudo aqui é fictício e fica só no seu navegador.</li>
        </ul>
      </div>
    </div>
  </section>
</main>
<script>
  const show = () => {
    const s = (location.hash || '#app').slice(1);
    const name = ['app', 'painel', 'design', 'notas'].includes(s) ? s : 'app';
    document.querySelectorAll('section').forEach((el) => el.classList.toggle('on', el.id === 's-' + name));
    document.querySelectorAll('nav a').forEach((a) => a.classList.toggle('on', a.dataset.s === name));
  };
  window.addEventListener('hashchange', show);
  show();
</script>
</body>
</html>`;
fs.writeFileSync('preview/index.html', html);
console.log('preview/index.html ok');
