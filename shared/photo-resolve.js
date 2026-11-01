/**
 * Escolhe uma foto real para QUALQUER área de imagem do app e do painel.
 *
 * Ordem de escolha:
 *  1. o arquivo pedido, se existir;
 *  2. um "parecido" da tabela ALIASES (praia → praia, Europa → Europa…);
 *  3. para lugares/destinos ("place:<id>" / "dest:<id>"), uma foto do mesmo país/região,
 *     alternando entre as disponíveis para não repetir sempre a mesma;
 *  4. qualquer foto disponível, escolhida de forma estável pela chave.
 *
 * Assim nenhuma tela fica sem foto enquanto o banco de imagens cresce: é só adicionar o
 * arquivo em apps/mobile/assets/photos que ele passa a valer no lugar do substituto.
 */
import { DESTINATIONS, PLACES } from './library.js';

const ALIASES = {
  'rio.jpg': 'zanzibar-praias.jpg',
  'rio-cristo.jpg': 'zanzibar-praias.jpg',
  'disney.jpg': 'paris-torre-vertical.jpg',
  'disney-castelo.jpg': 'paris-eiffel.jpg',
  'nova-york.jpg': 'londres-cabines.jpg',
  'machu-picchu.jpg': 'muralha-da-china.jpg',
  'machu-picchu-cidadela.jpg': 'muralha-da-china.jpg',
  'ilha-de-pascoa.jpg': 'santorini-oia.jpg',
  'pascoa-moais.jpg': 'santorini-oia.jpg',
  'italia.jpg': 'italia-comida.jpg',
  'florenca.jpg': 'roma-coliseu.jpg',
  'florenca-duomo.jpg': 'roma-coliseu.jpg',
  'veneza.jpg': 'roma-trevi.jpg',
  'veneza-canal.jpg': 'roma-trevi.jpg',
  'atenas.jpg': 'grecia-mesa.jpg',
  'atenas-partenon.jpg': 'roma-coliseu.jpg',
  'madri.jpg': 'barcelona-sagrada.jpg',
  'granada.jpg': 'barcelona-sagrada.jpg',
  'islandia.jpg': 'pequim-beihai.jpg',
  'islandia-lagoon.jpg': 'zanzibar-praias.jpg',
  'mexico-teotihuacan.jpg': 'mexico-tacos.jpg',
  'riviera-maya.jpg': 'zanzibar-praias.jpg',
  'aruba.jpg': 'zanzibar-praias.jpg',
  'aruba-eagle.jpg': 'zanzibar-praias.jpg',
  'lisboa.jpg': 'londres-big-ben.jpg',
  'lisboa-belem.jpg': 'londres-big-ben.jpg',
  'toquio.jpg': 'pequim-beihai.jpg',
  'toquio-sensoji.jpg': 'pequim-beihai.jpg',
};

const hash = (s) => [...String(s)].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);
const destById = Object.fromEntries(DESTINATIONS.map((d) => [d.id, d]));
const countryOf = (id) => destById[id]?.country;

/** available: lista de nomes de arquivo que existem (ex.: ['paris-eiffel.jpg', …]). */
export function createPhotoResolver(available) {
  const have = new Set(available);
  const list = [...available].sort();
  const direct = (name) => (name && have.has(name) ? name : name && have.has(ALIASES[name]) ? ALIASES[name] : null);

  // Fotos "do mesmo país": as dos destinos e lugares desse país que existem de verdade.
  const byCountry = {};
  for (const item of [...DESTINATIONS.map((d) => ({ c: d.country, p: d.photo })), ...PLACES.map((p) => ({ c: countryOf(p.destination), p: p.photo }))]) {
    if (item.p && have.has(item.p)) (byCountry[item.c] ||= new Set()).add(item.p);
  }

  return function resolve(key) {
    if (!list.length) return null;
    const k = String(key || '');
    const own = direct(k);
    if (own) return own;
    if (k.startsWith('place:') || k.startsWith('dest:')) {
      const id = k.split(':')[1];
      const place = k.startsWith('place:') ? PLACES.find((p) => p.id === id) : null;
      const dest = destById[place ? place.destination : id];
      const fromOwn = direct(place?.photo) || (!place && direct(dest?.photo));
      if (fromOwn) return fromOwn;
      const pool = [...(byCountry[dest?.country] || [])].sort();
      if (pool.length) return pool[hash(k) % pool.length];
      const fromDest = direct(dest?.photo);
      if (fromDest) return fromDest;
    }
    return list[hash(k) % list.length];
  };
}
