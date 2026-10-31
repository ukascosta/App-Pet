/**
 * Lê brand/logo-vagari.svg e brand/faces.svg (arquivos da identidade) e gera shared/brand.js:
 *  - logo: caminhos do wordmark, do "V" e da estrela, com viewBox ajustado
 *  - avatars: as carinhas, cada uma como SVG independente (estilos já embutidos)
 * Uso: node scripts/build-brand.mjs
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

// ---------------------------------------------------------------- logo
const logoSvg = fs.readFileSync('brand/logo-vagari.svg', 'utf8');
const firstGroup = logoSvg.match(/<g>([\s\S]*?)<\/g>/)[1];
const paths = [...firstGroup.matchAll(/<path class="(st\d)" d="([^"]+)"\/>/g)].map((m) => ({ cls: m[1], d: m[2] }));
if (paths.length !== 3) throw new Error(`esperava 3 caminhos no logo, achei ${paths.length}`);
const [word, v, star] = paths; // palavra "agari" (com i-pingo), "V", estrela laranja

// bounding boxes reais com o navegador
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="700" viewBox="0 0 841.9 595.3"><path id="a" d="${word.d}"/><path id="b" d="${v.d}"/><path id="c" d="${star.d}"/></svg>`);
const box = async (ids) =>
  page.evaluate((ids) => {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const id of ids) {
      const b = document.getElementById(id).getBBox();
      x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.width); y1 = Math.max(y1, b.y + b.height);
    }
    return [x0, y0, x1 - x0, y1 - y0];
  }, ids);
const full = await box(['a', 'b', 'c']);
const vOnly = await box(['b', 'c']);
const r2 = (n) => Math.round(n * 10) / 10;
const pad = 3;
const fullBox = [r2(full[0] - pad), r2(full[1] - pad), r2(full[2] + pad * 2), r2(full[3] + pad * 2)];
const vBox = [r2(vOnly[0] - 2), r2(vOnly[1] - 2), r2(vOnly[2] + 4), r2(vOnly[3] + 4)];

// ---------------------------------------------------------------- carinhas
const faces = fs.readFileSync('brand/faces.svg', 'utf8');
const style = Object.fromEntries([...faces.matchAll(/\.(st\d+)\s*\{([^}]*)\}/g)].map((m) => [m[1], m[2]]));
const fillOf = (cls) => (style[cls]?.match(/fill:\s*([^;\s]+)/) || [])[1];
const clipCircles = Object.fromEntries(
  [...faces.matchAll(/<clipPath id="([^"]+)">\s*(<circle[^>]*\/>)/g)].map((m) => {
    const a = (k) => +m[2].match(new RegExp(`${k}="([\\d.-]+)"`))[1];
    return [m[1], { cx: a('cx'), cy: a('cy'), r: a('r'), tag: m[2] }];
  }),
);
const classToClip = Object.fromEntries([...faces.matchAll(/\.(st\d+)\s*\{\s*clip-path:\s*url\(#([^)]+)\)/g)].map((m) => [m[1], m[2]]));
const body = faces.slice(faces.indexOf('</defs>') + 7, faces.lastIndexOf('</svg>'));
const groups = [...body.matchAll(/<g class="(st\d+)">([\s\S]*?)\n  <\/g>/g)];

const inline = (svg) =>
  svg.replace(/ class="(st\d+)"/g, (_, c) => {
    const f = fillOf(c);
    return f && f !== 'none' ? ` fill="${f}"` : c === 'st0' ? ' fill="none"' : '';
  });

const avatars = [];
for (const [, cls, inner] of groups) {
  const clipId = classToClip[cls];
  const c = clipCircles[clipId];
  if (!c) continue;
  const circle = c.tag.replace(/ class="st0"/, '');
  const content = inline(inner).replace(/\s*\n\s*/g, '');
  const vb = `${r2(c.cx - c.r)} ${r2(c.cy - c.r)} ${r2(c.r * 2)} ${r2(c.r * 2)}`;
  avatars.push({ id: `face-${avatars.length + 1}`, viewBox: vb, xml: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}"><defs><clipPath id="${clipId}">${circle}</clipPath></defs><g clip-path="url(#${clipId})">${content}</g></svg>` });
}
await browser.close();

const out = `/** GERADO por scripts/build-brand.mjs a partir de brand/*.svg — não edite à mão. */
export const LOGO = {
  fullBox: ${JSON.stringify(fullBox)},
  vBox: ${JSON.stringify(vBox)},
  word: ${JSON.stringify(word.d)},
  v: ${JSON.stringify(v.d)},
  star: ${JSON.stringify(star.d)},
  // cores originais do arquivo de marca
  purple: '${fillOf(word.cls) || '#5C1C59'}',
  orange: '${fillOf(star.cls) || '#E2801F'}',
};

export const AVATARS = ${JSON.stringify(avatars)};
`;
fs.writeFileSync('shared/brand.js', out);
console.log('logo', fullBox, 'V', vBox, '| carinhas:', avatars.length, '| bytes', out.length);
