// Ilustrações e avatares no estilo da marca: formas chapadas em preto, laranja e verde-menta.

import { BRAND, catInner, dogInner } from './brand.js';
import { CAT_FACES, DOG_FACES, FACES } from './faces.js';

const O = BRAND.orange;
const M = BRAND.mint;
const K = '#111';
const O2 = '#FFB866';
const O3 = '#FFD9AE';
const O4 = '#FFEEDB';
const M2 = '#BDF3E6';
const KIBBLE = '#B85C00';
const KIBBLE_HI = '#E58A2B';

// ---------- avatares dos pets ----------

const COATS = {
  preto: '#151515',
  branco: '#F4EFE6',
  caramelo: '#C98A4B',
  marrom: '#7B4A2A',
  cinza: '#8D939C',
  dourado: '#E0A93B',
  creme: '#EBD9B0',
  tigrado: '#A8703A',
  malhado: '#B9A58E',
  tricolor: '#6B4A33',
  'preto e branco': '#1D1D1D',
};

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Cor do pelo desenhada no avatar (cai no preto da marca se for uma cor desconhecida). */
export function coatFor(colorName) {
  const fill = COATS[norm(colorName)] ?? '#151515';
  return { fill, light: luminance(fill) > 0.55 };
}

const hash = (str) => [...String(str)].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
export const TONES = 6; // fundos pastel: pêssego, menta, lilás, manteiga, céu, rosa

/** Avatar: a carinha ilustrada (cão ou gato) sobre um fundo pastel. Cada pet mantém sempre a mesma carinha e cor. */
export function petAvatar(pet, cls = '') {
  const h = hash(`${pet.name ?? ''}${pet.id ?? ''}`);
  const faces = pet.species === 'cat' ? CAT_FACES : DOG_FACES;
  const face = faces[h % faces.length];
  const tone = (h >> 3) % TONES;
  const label = pet.species === 'cat' ? 'Gato' : 'Cachorro';
  return `<span class="pet-av tone-${tone} ${cls}" role="img" aria-label="${label}"><svg viewBox="0 0 400 400"><path fill="currentColor" fill-rule="evenodd" d="${FACES[face]}"/></svg></span>`;
}

/** Só a carinha (sem fundo) para os botões de escolha de espécie. */
export const speciesMark = (species) =>
  `<svg viewBox="0 0 400 400" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="${FACES[species === 'cat' ? 'cat1' : 'dog1']}"/></svg>`;

// ---------- cenas ----------

const sparkle = (x, y, s, fill) =>
  `<path transform="translate(${x} ${y}) scale(${s})" fill="${fill}" d="M0-10Q0 0 10 0Q0 0 0 10Q0 0-10 0Q0 0 0-10Z"/>`;

const svg = (label, body, vb = '0 0 320 260') =>
  `<svg class="art" viewBox="${vb}" role="img" aria-label="${label}">${body}</svg>`;

const backdrop = (color = O4) =>
  `<ellipse cx="160" cy="236" rx="128" ry="13" fill="${O3}" opacity=".75"/><circle cx="160" cy="132" r="114" fill="${color}"/>`;

/** Tigela de ração com um monte de croquetes. */
function bowl(x, y, kibble = true, scale = 1) {
  const pieces = [
    [20, -8, 9], [42, -15, 10], [64, -10, 10], [86, -16, 10], [108, -8, 9], [53, -29, 9], [77, -28, 9], [96, -4, 8], [32, -2, 8],
  ];
  const kib = kibble
    ? pieces.map(([dx, dy, r]) => `<circle cx="${x + dx}" cy="${y + dy}" r="${r}" fill="${KIBBLE}"/><circle cx="${x + dx - 2.5}" cy="${y + dy - 2.5}" r="${r * 0.38}" fill="${KIBBLE_HI}"/>`).join('')
    : '';
  const body = `${kib}<path d="M${x + 4} ${y + 6}h114c0 31-23 53-57 53S${x + 4} ${y + 37} ${x + 4} ${y + 6}Z" fill="${O}"/><rect x="${x - 4}" y="${y - 4}" width="130" height="16" rx="8" fill="#E57600"/>`;
  // a escala é feita a partir do centro da base da tigela
  return scale === 1 ? body : `<g transform="translate(${x + 61} ${y + 59}) scale(${scale}) translate(${-(x + 61)} ${-(y + 59)})">${body}</g>`;
}

/** Onboarding 1: a porção certa para a raça. */
export function artPortion() {
  return svg(
    'Cachorro olhando para uma tigela de ração com a porção sugerida',
    `${backdrop()}
    <circle cx="268" cy="52" r="13" fill="${M2}"/>
    <g transform="translate(24 84) scale(.0706)">${dogInner()}</g>
    ${bowl(176, 172)}
    <g transform="translate(196 72)"><rect width="104" height="40" rx="20" fill="${K}"/><circle cx="21" cy="20" r="6" fill="${M}"/>
      <text x="64" y="27" text-anchor="middle" fill="#fff" font-family="Fredoka, sans-serif" font-size="19" font-weight="600">380 g</text></g>
    <path d="M247 114v22" stroke="${K}" stroke-width="3" stroke-dasharray="2 6" stroke-linecap="round"/>
    ${sparkle(48, 62, 1.1, M)}${sparkle(296, 150, 0.8, O)}${sparkle(150, 40, 0.7, O2)}`,
  );
}

/** Onboarding 2: contagem regressiva automática. */
export function artCountdown() {
  const c = 2 * Math.PI * 48;
  return svg(
    'Saco de ração e um marcador mostrando 12 dias restantes',
    `${backdrop()}
    <g transform="translate(40 58)">
      <rect y="22" width="104" height="146" rx="16" fill="${K}"/>
      <path d="M0 40V38a16 16 0 0 1 16-16h72a16 16 0 0 1 16 16v2Z" fill="#2A2A2A"/>
      <path d="M8 30h88" stroke="#444" stroke-width="3" stroke-dasharray="4 5" stroke-linecap="round"/>
      <rect x="14" y="62" width="76" height="70" rx="14" fill="${O}"/>
      <g transform="translate(52 100) scale(1.5)" fill="${K}"><ellipse cx="-9" cy="-2" rx="2.6" ry="3.6"/><ellipse cx="-3.5" cy="-8" rx="2.6" ry="3.6"/><ellipse cx="3.5" cy="-8" rx="2.6" ry="3.6"/><ellipse cx="9" cy="-2" rx="2.6" ry="3.6"/><path d="M0-1c-4 0-8 4.5-8 8 0 2.6 2 3.6 4 3.6 1.4 0 2.2-.6 4-.6s2.6.6 4 .6c2 0 4-1 4-3.6 0-3.5-4-8-8-8z"/></g>
      <circle cx="30" cy="148" r="4" fill="${M}"/><circle cx="46" cy="148" r="4" fill="${M}" opacity=".6"/><circle cx="62" cy="148" r="4" fill="${M}" opacity=".3"/>
    </g>
    <g transform="translate(240 128)">
      <circle r="48" fill="#fff"/>
      <circle r="48" fill="none" stroke="${O3}" stroke-width="13"/>
      <circle r="48" fill="none" stroke="${M}" stroke-width="13" stroke-linecap="round" stroke-dasharray="${(c * 0.72).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90)"/>
      <text y="9" text-anchor="middle" fill="${K}" font-family="Fredoka, sans-serif" font-size="38" font-weight="600">12</text>
      <text y="29" text-anchor="middle" fill="#6B625A" font-family="Nunito, sans-serif" font-size="13" font-weight="700">dias</text>
    </g>
    ${sparkle(278, 52, 1, O)}${sparkle(46, 40, 0.8, M)}${sparkle(190, 226, 0.7, O2)}`,
  );
}

/** Onboarding 3: a loja é avisada pelo WhatsApp. */
export function artStore() {
  return svg(
    'Celular com a notificação de ração acabando e a conversa com a loja',
    `${backdrop()}
    <g transform="translate(108 24)">
      <rect width="112" height="204" rx="24" fill="${K}"/>
      <rect x="7" y="7" width="98" height="190" rx="18" fill="#fff"/>
      <rect x="38" y="13" width="36" height="7" rx="3.5" fill="${K}"/>
      <rect x="14" y="34" width="84" height="46" rx="12" fill="${O4}"/>
      <circle cx="31" cy="57" r="11" fill="${O}"/>
      <path transform="translate(23 49) scale(.66)" d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" fill="none" stroke="${K}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="49" y="47" width="42" height="7" rx="3.5" fill="${K}"/><rect x="49" y="60" width="28" height="6" rx="3" fill="#C9C1B8"/>
      <rect x="14" y="92" width="64" height="32" rx="12" fill="#EFEAE3"/><rect x="24" y="104" width="38" height="6" rx="3" fill="#C9C1B8"/>
      <rect x="34" y="134" width="64" height="32" rx="12" fill="${M}"/><rect x="44" y="146" width="40" height="6" rx="3" fill="#fff"/>
      <rect x="14" y="176" width="84" height="12" rx="6" fill="#F3ECE4"/>
    </g>
    <g transform="translate(66 78)"><circle r="31" fill="${O}"/>
      <path transform="translate(-14 -15) scale(1.2)" d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" fill="none" stroke="${K}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="19" cy="-19" r="8" fill="${M}" stroke="#fff" stroke-width="3"/></g>
    <g transform="translate(236 152)">
      <path d="M-6 -4h60l-5 -22h-50z" fill="${O}"/><path d="M0 -4h12l-1 -22h-10zM24 -4h12l-1 -22h-10z" fill="#fff" opacity=".35"/>
      <rect x="0" y="-4" width="48" height="50" rx="4" fill="${O3}"/><rect x="16" y="14" width="16" height="32" rx="3" fill="${K}"/><rect x="5" y="8" width="8" height="10" rx="2" fill="#fff"/><rect x="35" y="8" width="8" height="10" rx="2" fill="#fff"/>
      <path d="M-6 -4q6 10 12 0t12 0 12 0 12 0 12 0" fill="${O2}"/>
    </g>
    ${sparkle(272, 56, 1, M)}${sparkle(40, 170, 0.8, O)}`,
  );
}

/** Estado vazio: nenhum pet cadastrado. */
export function artEmptyPets() {
  return svg(
    'Cachorro e gato esperando ao lado de uma tigela vazia',
    `${backdrop()}
    <g transform="translate(28 66) scale(.0705)">${dogInner()}</g>
    <g transform="translate(176 70) scale(.0705)">${catInner()}</g>
    ${bowl(100, 190, false, 0.62)}
    ${sparkle(278, 60, 1, O)}${sparkle(52, 52, 0.9, M)}${sparkle(160, 46, 0.6, O2)}`,
  );
}

/** Estado vazio: nenhum aviso. */
export function artEmptyAlerts() {
  return svg(
    'Sino em silêncio: nenhum aviso por enquanto',
    `${backdrop()}
    <g transform="translate(160 132)">
      <path d="M-52 36V-6a52 52 0 0 1 104 0v42l14 18h-132Z" fill="${K}"/>
      <rect x="-9" y="-72" width="18" height="16" rx="8" fill="${K}"/>
      <path d="M-18 66a18 14 0 0 0 36 0Z" fill="${O}"/>
      <path d="M-34 -4a34 34 0 0 1 22-30" fill="none" stroke="#3A3A3A" stroke-width="7" stroke-linecap="round"/>
    </g>
    <text x="236" y="86" fill="${M}" font-family="Fredoka, sans-serif" font-size="30" font-weight="600">z</text>
    <text x="256" y="64" fill="${M}" font-family="Fredoka, sans-serif" font-size="22" font-weight="600" opacity=".7">z</text>
    <text x="272" y="46" fill="${M}" font-family="Fredoka, sans-serif" font-size="15" font-weight="600" opacity=".45">z</text>
    ${sparkle(64, 70, 1, O)}${sparkle(90, 196, 0.7, M)}`,
  );
}

/** Pet cadastrado com sucesso. */
export function artSuccess(species = 'dog') {
  const bits = [
    [60, 50, O, 20], [270, 62, M, -25], [96, 28, K, 40], [236, 34, O, -10], [40, 130, M, 60], [288, 140, O, 15], [214, 20, M, 30], [128, 52, O2, -40],
  ].map(([x, y, fill, rot]) => `<rect x="${x}" y="${y}" width="12" height="6" rx="2" fill="${fill}" transform="rotate(${rot} ${x} ${y})"/>`).join('');
  return svg(
    'Cachorro comemorando com confete',
    `${backdrop()}${bits}
    <g transform="translate(98 88) scale(.0735)">${species === 'cat' ? catInner() : dogInner()}</g>
    <g transform="translate(264 86)"><circle r="32" fill="${M}"/><path d="M-14 1-4 11 15-10" fill="none" stroke="${K}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></g>
    ${sparkle(268, 98, 1.1, O)}${sparkle(44, 76, 0.8, M)}`,
  );
}

/** Algo deu errado / sem conexão. */
export function artError() {
  return svg(
    'Cachorro confuso com um ponto de interrogação',
    `${backdrop()}
    <g transform="translate(86 80) scale(.0775)">${dogInner()}</g>
    <g transform="translate(228 112)"><circle r="38" fill="${O}"/>
      <text y="16" text-anchor="middle" fill="${K}" font-family="Fredoka, sans-serif" font-size="52" font-weight="600">?</text></g>
    ${sparkle(60, 60, 0.9, M)}${sparkle(278, 196, 0.8, O2)}`,
  );
}
