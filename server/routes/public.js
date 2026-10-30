import { Router } from 'express';
import { BREEDS, breedsOf, findBreed } from '../data/breeds.js';
import { MAX_MEALS, defaultTimes } from '../lib/feeding.js';
import { recommend } from '../lib/nutrition.js';
import { HttpError, bool, number, oneOf } from '../lib/validate.js';

export function publicRoutes({ config, push, oauth }) {
  const router = Router();

  router.get('/config', (_req, res) => {
    res.json({
      store: { name: config.store.name, whatsapp: config.store.whatsapp },
      vapidPublicKey: push.publicKey,
      // Horários padrão para cada quantidade de refeições (fonte única, usada pela tela de rotina).
      feeding: { times: Object.fromEntries(Array.from({ length: MAX_MEALS }, (_, i) => [i + 1, defaultTimes(i + 1)])) },
      auth: { google: oauth.isEnabled('google'), facebook: oauth.isEnabled('facebook'), preview: !config.isProd },
    });
  });

  router.get('/breeds', (req, res) => {
    const list = req.query.species ? breedsOf(oneOf(req.query.species, 'species', ['dog', 'cat'], 'cão ou gato')) : BREEDS;
    res.json(list.map(({ id, name, species, size, minKg, maxKg, other }) => ({ id, name, species, size, minKg, maxKg, other: !!other })));
  });

  // Prévia da sugestão enquanto a pessoa preenche o cadastro do pet.
  router.post('/recommendation', (req, res) => {
    const b = req.body ?? {};
    const species = oneOf(b.species, 'species', ['dog', 'cat'], 'cão ou gato');
    const breed = findBreed(b.breedId);
    if (!breed || breed.species !== species) throw new HttpError(400, 'Escolha a raça do pet.', 'breedId');

    const adultKg = breed.other ? number(b.adultKg, 'adultKg', 'o peso adulto aproximado', { min: 1, max: 100 }) : breed.adultKg;
    const years = number(b.ageYears ?? 0, 'ageYears', 'a idade em anos', { min: 0, max: 30 });
    const months = number(b.ageMonths ?? 0, 'ageMonths', 'a idade em meses', { min: 0, max: 11 });

    res.json(
      recommend({
        species,
        adultKg,
        ageMonths: years * 12 + months,
        weightKg: number(b.weightKg, 'weightKg', 'o peso', { min: 0.3, max: 120, optional: true }) ?? undefined,
        neutered: bool(b.neutered, true),
        kcalPerKg: number(b.kcalPerKg, 'kcalPerKg', 'a energia da ração', { min: 2500, max: 5500, optional: true }) ?? undefined,
        deepChested: breed.deepChested ?? false,
      }),
    );
  });

  return router;
}
