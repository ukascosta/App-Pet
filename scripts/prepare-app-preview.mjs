/**
 * Pega o export web do Expo e deixa pronto para rodar numa subpasta (caminhos relativos),
 * mantendo só as fontes realmente usadas.  Uso: node scripts/prepare-app-preview.mjs <export> <destino>
 */
import fs from 'node:fs';
import path from 'node:path';
const [src, dest] = process.argv.slice(2);
fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });
const jsDir = path.join(src, '_expo/static/js/web');
const bundleName = fs.readdirSync(jsDir).find((f) => f.endsWith('.js'));
let js = fs.readFileSync(path.join(jsDir, bundleName), 'utf8');
const used = [...new Set(js.match(/"\/assets\/[^"]+"/g) || [])].map((s) => s.slice(1, -1));
// Fontes embutidas como data: URI (a prévia publicada só aceita fontes inline ou do Google Fonts).
for (const u of used.filter((x) => /\.(ttf|otf)$/.test(x))) {
  const data = fs.readFileSync(path.join(src, u)).toString('base64');
  js = js.replaceAll(`"${u}"`, `"data:font/${u.endsWith('.otf') ? 'otf' : 'ttf'};base64,${data}"`);
}
for (const u of used.filter((x) => !/\.(ttf|otf)$/.test(x))) {
  const from = path.join(src, u);
  const rel = u.replace('/assets/node_modules/', 'assets/m/').replace(/^\//, '');
  if (fs.existsSync(from)) {
    fs.mkdirSync(path.dirname(path.join(dest, rel)), { recursive: true });
    fs.copyFileSync(from, path.join(dest, rel));
  }
}
js = js.replaceAll('"/assets/node_modules/', '"./assets/m/').replaceAll('"/assets/', '"./assets/');
fs.mkdirSync(path.join(dest, 'js'), { recursive: true });
fs.writeFileSync(path.join(dest, 'js/app.js'), js);
let html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
html = html
  .replace(/<script src="\/_expo\/static\/js\/web\/[^"]+" defer><\/script>/, '<script src="./js/app.js" defer></script>')
  .replace('<link rel="icon" href="/favicon.ico"/>', '')
  .replace('<title>mobile</title>', '<title>Vagari — app</title>')
  .replace('<html lang="en">', '<html lang="pt-BR">')
  .replace('httpEquiv', 'http-equiv');
fs.writeFileSync(path.join(dest, 'index.html'), html);
console.log(`ok: ${used.length} assets, bundle ${(js.length / 1e6).toFixed(2)} MB`);
