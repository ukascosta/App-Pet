// Gera preview/petlee-preview.html: um arquivo único (sem servidor) com o app, a API simulada e a moldura.
// Uso: npm run preview

import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';

const root = path.resolve(import.meta.dirname, '..');
const p = (...parts) => path.join(root, ...parts);

// No lugar do push real (Service Worker), usa o push simulado.
const pushMock = {
  name: 'push-mock',
  setup(b) {
    b.onResolve({ filter: /(^|\/)push\.js$/ }, (args) => (args.importer.includes(`${path.sep}public${path.sep}js${path.sep}`) ? { path: p('preview/push-mock.js') } : null));
  },
};

async function bundle(entry) {
  const result = await build({ entryPoints: [p(entry)], bundle: true, format: 'iife', minify: true, write: false, target: 'es2022', plugins: [pushMock], legalComments: 'none', logLevel: 'warning' });
  // evita fechar o <script> sem querer
  return result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
}

const fontUri = (file) => `data:font/woff2;base64,${fs.readFileSync(p('public/fonts', file)).toString('base64')}`;
const withFonts = (css) =>
  css.replace(/url\('\/fonts\/([^']+)'\)/g, (_m, file) => `url('${fontUri(file)}')`);

const [appJs, shellJs] = await Promise.all([bundle('preview/entry-app.js'), bundle('preview/shell/shell.js')]);
const appCss = withFonts(fs.readFileSync(p('public/styles.css'), 'utf8'));

// A página do app (vai dentro do iframe da moldura).
// <base about:srcdoc>: sem ele, links como href="#/cadastro" navegariam o iframe para o arquivo da moldura.
const appDoc = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><base href="about:srcdoc"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>PetLee</title><style>${appCss}</style></head><body><div id="app"></div><script>${appJs}</script></body></html>`;

// A moldura (página que o usuário abre).
const fontFaces = appCss.match(/@font-face\s*{[^}]*}/g).join('\n');
const shellCss = fs.readFileSync(p('preview/shell/shell.css'), 'utf8');
const shellHtml = fs.readFileSync(p('preview/shell/shell.html'), 'utf8');
// Num bloco application/json só o '<' precisa de escape (para não fechar a tag); quem lê é o JSON.parse.
const json = JSON.stringify(appDoc).replace(/</g, '\\u003c');
const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>PetLee — pré-visualização interativa</title>
<meta name="description" content="Teste o app PetLee no navegador: telas, cenários, avisos simulados e roteiro de usabilidade.">
<style>${fontFaces}\n${shellCss}</style>
</head>
<body>
${shellHtml}
<script type="application/json" id="app-doc">${json}</script>
<script>${shellJs}</script>
</body>
</html>
`;

const out = p('preview/petlee-preview.html');
fs.writeFileSync(out, html);
console.log(`Gerado: ${path.relative(root, out)} (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB)`);
