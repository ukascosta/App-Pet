/** Gera apps/mobile/src/lib/photos.js a partir dos arquivos em apps/mobile/assets/photos. */
import fs from 'node:fs';
const files = fs.readdirSync('apps/mobile/assets/photos').filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
const body = files.map((f) => `  '${f}': require('../../assets/photos/${f}'),`).join('\n');
fs.writeFileSync('apps/mobile/src/lib/photos.js', `/**
 * GERADO por scripts/build-photos.mjs — rode "npm run photos" depois de adicionar fotos.
 * Cada arquivo de assets/photos entra aqui. Sem foto, o app mostra a capa ilustrada (ver docs/FOTOS.md).
 */
export const PHOTOS = {
${body}
};
`);
console.log(files.length, 'fotos registradas');
