// Catálogo de raças com peso adulto típico (kg, mínimo e máximo).
// Fonte dos intervalos: padrões das raças (FCI/AKC/CBKC/TICA/CFA), arredondados.
// O peso adulto serve de base para estimar a porção diária (ver lib/nutrition.js).
//
// Formato: [id, nome (com apelidos para a busca), espécie, kg mínimo, kg máximo]

import { sizeOf } from '../lib/nutrition.js';

const DOGS = [
  ['srd-pequeno', 'SRD – Vira-lata (pequeno porte)', 4, 10],
  ['srd-medio', 'SRD – Vira-lata (médio porte)', 10, 25],
  ['srd-grande', 'SRD – Vira-lata (grande porte)', 25, 40],
  ['affenpinscher', 'Affenpinscher', 3, 6],
  ['afghan-hound', 'Galgo Afegão (Afghan Hound)', 23, 27],
  ['airedale-terrier', 'Airedale Terrier', 20, 29],
  ['akita', 'Akita', 30, 45],
  ['alaskan-malamute', 'Malamute do Alasca', 34, 43],
  ['american-bully', 'American Bully', 20, 36],
  ['american-staffordshire', 'American Staffordshire Terrier (Amstaff)', 18, 28],
  ['australian-cattle-dog', 'Boiadeiro Australiano (Australian Cattle Dog)', 15, 22],
  ['australian-shepherd', 'Pastor Australiano (Australian Shepherd)', 18, 30],
  ['basenji', 'Basenji', 9, 11],
  ['basset-hound', 'Basset Hound', 20, 29],
  ['beagle', 'Beagle', 9, 14],
  ['bearded-collie', 'Bearded Collie', 18, 27],
  ['bernese', 'Boiadeiro Bernês (Bernese Mountain Dog)', 36, 50],
  ['bichon-frise', 'Bichon Frisé', 5, 8],
  ['bloodhound', 'Bloodhound (Cão de Santo Humberto)', 36, 50],
  ['border-collie', 'Border Collie', 14, 20],
  ['border-terrier', 'Border Terrier', 5, 7],
  ['borzoi', 'Borzoi', 25, 47],
  ['boston-terrier', 'Boston Terrier', 5, 11],
  ['boxer', 'Boxer', 25, 32],
  ['briard', 'Briard', 30, 40],
  ['buldogue-campeiro', 'Buldogue Campeiro', 25, 35],
  ['buldogue-frances', 'Buldogue Francês (Bulldog Francês)', 8, 14],
  ['buldogue-ingles', 'Buldogue Inglês (Bulldog Inglês)', 18, 25],
  ['bull-terrier', 'Bull Terrier', 20, 32],
  ['bullmastiff', 'Bullmastiff', 45, 59],
  ['cairn-terrier', 'Cairn Terrier', 6, 8],
  ['cane-corso', 'Cane Corso', 40, 50],
  ['cao-agua-portugues', 'Cão de Água Português', 16, 25],
  ['cao-crista-chines', 'Cão de Crista Chinês', 2, 6],
  ['cavalier', 'Cavalier King Charles Spaniel', 5, 8],
  ['chihuahua', 'Chihuahua', 1.5, 3],
  ['chin-japones', 'Chin Japonês', 2, 4],
  ['chow-chow', 'Chow Chow', 20, 32],
  ['cocker-americano', 'Cocker Spaniel Americano', 7, 14],
  ['cocker-ingles', 'Cocker Spaniel Inglês', 12, 15],
  ['collie', 'Collie', 18, 32],
  ['coton-de-tulear', 'Coton de Tuléar', 4, 7],
  ['dachshund', 'Dachshund (Salsicha)', 4, 12],
  ['dalmata', 'Dálmata', 20, 32],
  ['dobermann', 'Dobermann', 30, 40],
  ['dogo-argentino', 'Dogo Argentino', 35, 45],
  ['dogue-alemao', 'Dogue Alemão (Great Dane)', 50, 80],
  ['fila-brasileiro', 'Fila Brasileiro', 40, 50],
  ['fox-paulistinha', 'Fox Paulistinha (Terrier Brasileiro)', 5, 9],
  ['fox-terrier', 'Fox Terrier', 7, 9],
  ['galgo-ingles', 'Galgo Inglês (Greyhound)', 27, 40],
  ['golden-retriever', 'Golden Retriever', 25, 34],
  ['havanes', 'Bichon Havanês', 3, 6],
  ['husky', 'Husky Siberiano', 16, 27],
  ['irish-wolfhound', 'Wolfhound Irlandês', 40, 55],
  ['jack-russell', 'Jack Russell Terrier', 5, 8],
  ['keeshond', 'Keeshond', 14, 18],
  ['labrador', 'Labrador Retriever', 25, 36],
  ['lagotto', 'Lagotto Romagnolo', 11, 16],
  ['leonberger', 'Leonberger', 40, 70],
  ['lhasa-apso', 'Lhasa Apso', 5, 8],
  ['maltes', 'Maltês', 2, 4],
  ['maltipoo', 'Maltipoo (Maltês × Poodle)', 3, 8],
  ['mastiff', 'Mastiff Inglês', 55, 90],
  ['mastim-napolitano', 'Mastim Napolitano', 50, 70],
  ['mastim-tibetano', 'Mastim Tibetano', 45, 70],
  ['papillon', 'Papillon', 3, 5],
  ['pastor-alemao', 'Pastor Alemão', 22, 40],
  ['pastor-belga-malinois', 'Pastor Belga Malinois', 20, 30],
  ['pastor-branco-suico', 'Pastor Branco Suíço', 25, 40],
  ['pastor-shetland', 'Pastor de Shetland (Sheltie)', 6, 12],
  ['pequines', 'Pequinês', 3, 6],
  ['pinscher', 'Pinscher Miniatura', 3, 5],
  ['pit-bull', 'Pit Bull (American Pit Bull Terrier)', 14, 27],
  ['pointer-ingles', 'Pointer Inglês', 20, 30],
  ['pointer-alemao', 'Pointer Alemão', 20, 32],
  ['pomerania', 'Lulu da Pomerânia (Spitz Alemão Anão)', 1.5, 3.5],
  ['poodle-toy', 'Poodle Toy', 2, 4],
  ['poodle-anao', 'Poodle Anão', 4, 7],
  ['poodle-medio', 'Poodle Médio', 7, 12],
  ['poodle-standard', 'Poodle Standard (Gigante)', 20, 32],
  ['pug', 'Pug', 6, 9],
  ['rhodesian', 'Rhodesian Ridgeback', 30, 40],
  ['rottweiler', 'Rottweiler', 40, 55],
  ['saluki', 'Saluki', 15, 30],
  ['samoieda', 'Samoieda', 20, 30],
  ['sao-bernardo', 'São Bernardo', 55, 80],
  ['schnauzer-miniatura', 'Schnauzer Miniatura', 5, 9],
  ['schnauzer-standard', 'Schnauzer Standard', 14, 20],
  ['schnauzer-gigante', 'Schnauzer Gigante', 30, 47],
  ['scottish-terrier', 'Scottish Terrier', 8, 10],
  ['setter-gordon', 'Setter Gordon', 20, 36],
  ['setter-ingles', 'Setter Inglês', 20, 36],
  ['setter-irlandes', 'Setter Irlandês', 24, 32],
  ['shar-pei', 'Shar-Pei', 18, 29],
  ['shiba-inu', 'Shiba Inu', 8, 11],
  ['shih-tzu', 'Shih Tzu', 4, 8],
  ['spaniel-bretao', 'Spaniel Bretão', 13, 19],
  ['spitz-japones', 'Spitz Japonês', 5, 10],
  ['staffordshire-bull', 'Staffordshire Bull Terrier', 11, 17],
  ['terra-nova', 'Terra Nova', 50, 70],
  ['vizsla', 'Vizsla', 18, 27],
  ['weimaraner', 'Weimaraner', 25, 40],
  ['welsh-corgi', 'Welsh Corgi Pembroke', 10, 14],
  ['westie', 'West Highland White Terrier (Westie)', 6, 10],
  ['wheaten-terrier', 'Soft Coated Wheaten Terrier', 14, 20],
  ['whippet', 'Whippet', 9, 18],
  ['yorkshire', 'Yorkshire Terrier', 2, 3.5],
];

const CATS = [
  ['gato-srd', 'SRD – Gato sem raça definida (vira-lata)', 3, 6],
  ['abissinio', 'Abissínio', 3, 5],
  ['american-curl', 'American Curl', 3, 5],
  ['american-shorthair', 'American Shorthair', 4, 7],
  ['angora-turco', 'Angorá Turco', 2.5, 5],
  ['balines', 'Balinês', 2.5, 5],
  ['bengal', 'Bengal', 4, 7],
  ['birmanes', 'Sagrado da Birmânia (Birman)', 3, 6.5],
  ['burmes', 'Burmês', 3, 5.5],
  ['british-shorthair', 'British Shorthair (Britânico de Pelo Curto)', 4, 8],
  ['chartreux', 'Chartreux', 3, 7],
  ['cornish-rex', 'Cornish Rex', 2.5, 4.5],
  ['devon-rex', 'Devon Rex', 2.5, 4.5],
  ['exotico', 'Exótico (Exotic Shorthair)', 3.5, 6.5],
  ['himalaio', 'Himalaio', 3.5, 6.5],
  ['maine-coon', 'Maine Coon', 4.5, 10],
  ['manx', 'Manx', 3.5, 5.5],
  ['munchkin', 'Munchkin', 2.5, 4],
  ['noruegues-floresta', 'Norueguês da Floresta', 4, 9],
  ['oriental', 'Oriental', 3, 5],
  ['persa', 'Persa', 3, 6],
  ['ragamuffin', 'Ragamuffin', 5, 9],
  ['ragdoll', 'Ragdoll', 4.5, 9],
  ['russian-blue', 'Azul Russo (Russian Blue)', 3, 5.5],
  ['scottish-fold', 'Scottish Fold', 2.5, 6],
  ['selkirk-rex', 'Selkirk Rex', 3.5, 7],
  ['siames', 'Siamês', 2.5, 5],
  ['siberiano', 'Siberiano', 4.5, 9],
  ['singapura', 'Singapura', 1.8, 3.5],
  ['somali', 'Somali', 3, 5.5],
  ['sphynx', 'Sphynx (Esfinge)', 3.5, 5.5],
  ['tonquines', 'Tonquinês', 2.5, 5.5],
];

// Raças de peito profundo, com maior risco de torção gástrica: precisam dividir a porção em ao menos 2 refeições.
const DEEP_CHESTED = new Set([
  'afghan-hound', 'akita', 'basset-hound', 'bernese', 'bloodhound', 'borzoi', 'boxer', 'bullmastiff', 'cane-corso',
  'dobermann', 'dogo-argentino', 'dogue-alemao', 'galgo-ingles', 'irish-wolfhound', 'leonberger', 'mastiff',
  'mastim-napolitano', 'mastim-tibetano', 'pastor-alemao', 'pointer-alemao', 'poodle-standard', 'rhodesian',
  'rottweiler', 'saluki', 'sao-bernardo', 'schnauzer-gigante', 'setter-gordon', 'setter-ingles', 'setter-irlandes',
  'terra-nova', 'weimaraner', 'srd-grande',
]);

const toBreed = (species) => ([id, name, minKg, maxKg]) => {
  const adultKg = Math.round(((minKg + maxKg) / 2) * 10) / 10;
  return { id, name, species, minKg, maxKg, adultKg, size: sizeOf(species, adultKg), deepChested: DEEP_CHESTED.has(id) };
};

// "Outra raça": sem peso típico conhecido, o tutor informa o peso adulto esperado.
const OTHER = [
  { id: 'outra-cao', name: 'Outra raça (informar peso)', species: 'dog', other: true },
  { id: 'outra-gato', name: 'Outra raça (informar peso)', species: 'cat', other: true },
];

const collator = new Intl.Collator('pt-BR');
const byName = (a, b) => collator.compare(a.name, b.name);

// SRD aparece no topo da lista; o resto em ordem alfabética.
function sorted(list) {
  const srd = list.filter((b) => b.id.startsWith('srd') || b.id === 'gato-srd');
  const rest = list.filter((b) => !srd.includes(b)).sort(byName);
  return [...srd, ...rest];
}

export const BREEDS = [
  ...sorted(DOGS.map(toBreed('dog'))),
  ...sorted(CATS.map(toBreed('cat'))),
  ...OTHER,
];

const BY_ID = new Map(BREEDS.map((b) => [b.id, b]));

export const findBreed = (id) => BY_ID.get(id);
export const breedsOf = (species) => BREEDS.filter((b) => b.species === species);
