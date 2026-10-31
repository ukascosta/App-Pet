/** Extrai do Lucevias (MIT) só os ícones usados no app e no painel, já convertidos para dados. */
import fs from 'node:fs';
const src = process.argv[2];
const j = JSON.parse(fs.readFileSync(src, 'utf8'));
const by = Object.fromEntries(j.icons.map((i) => [i.name, i]));
// No Lucevias 0.6.2 os desenhos de arrow-left e arrow-right estão trocados.
[by['arrow-left'], by['arrow-right']] = [by['arrow-right'], by['arrow-left']];
const NAMES = `house compass compass-rose map-trifold calendar-dots calendar calendar-check list-checks files file-pdf file-image file-xls file-csv
user-circle user users user-plus airplane-tilt airplane-takeoff airplane-landing airplane-in-flight bed map-pin-simple map-pin-line check check-circle circle
suitcase-rolling identification-card bell bell-ringing heart magnifying-glass sliders-horizontal arrow-left arrow-right arrow-up-right arrow-square-out caret-right caret-down caret-left caret-up
x x-circle plus-circle chat-teardrop-dots chat-circle-dots seal-check clock globe-hemisphere-west city castle-turret buildings bank church sun cloud-sun waves snowflake
fork-knife coffee cheers shopping-bag camera bus car boat cable-car footprints info warning warning-circle share-network download-simple eye eye-slash lock envelope apple google-logo
gear-six sign-out trash pencil-simple upload-simple cloud-arrow-up clipboard-text chart-bar clock-counter-clockwise book-open lightbulb question flag-banner image images tag funnel
dots-three link copy paper-plane-tilt shield-check confetti moon fire receipt megaphone first-aid-kit currency-eur squares-four storefront hand-tap smiley-wink phone sparkle
thermometer-hot beach-ball crown-simple arrows-clockwise eye-closed list-bullets user-check device-mobile warning-circle file-arrow-up`.split(/\s+/).filter(Boolean);
const out = {};
const missing = [];
for (const n of NAMES) {
  const icon = by[n];
  if (!icon) { missing.push(n); continue; }
  out[n] = {};
  for (const w of ['regular', 'fill', 'duotone']) {
    const els = [];
    for (const m of icon.variants[w].matchAll(/<(path|circle|rect)\s([^>]*?)\/?>/g)) {
      const attrs = {};
      for (const a of m[2].matchAll(/([a-z-]+)="([^"]*)"/g)) attrs[a[1]] = a[2];
      const el = { t: m[1] };
      for (const k of ['d', 'cx', 'cy', 'r', 'x', 'y', 'width', 'height', 'rx', 'opacity']) if (attrs[k] !== undefined) el[k] = k === 'd' ? attrs[k].replace(/(\d+\.\d{2})\d+/g, '$1') : attrs[k];
      if (attrs['fill-rule']) el.fr = attrs['fill-rule'];
      if ((attrs.fill || '').includes('accent')) el.a = 1;
      if (attrs.stroke && attrs.stroke !== 'none') el.s = 1;
      els.push(el);
    }
    out[n][w] = els;
  }
}
fs.writeFileSync('shared/icons.json', JSON.stringify(out));
console.log(Object.keys(out).length, 'ícones; ausentes:', missing.join(' '));
