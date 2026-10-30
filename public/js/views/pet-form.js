// Cadastro/edição do pet em 3 passos: 1) quem é · 2) idade e peso · 3) ração.

import { api } from '../api.js';
import { html, debounce, fmtGrams, fmtKg, fmtNumber, normalizeText, speciesEmoji } from '../util.js';
import { busy, clearErrors, field, showError, toast } from '../ui.js';

const COLORS = ['Preto', 'Branco', 'Caramelo', 'Marrom', 'Cinza', 'Dourado', 'Creme', 'Tigrado', 'Malhado', 'Tricolor', 'Preto e branco'];
const BAG_SIZES = [1, 3, 7, 10.1, 15, 20];
const ALERT_OPTIONS = [3, 5, 7, 10, 15];
const STEP_TITLES = ['Quem é o seu pet?', 'Idade e peso', 'A ração dele'];
// Em qual passo cada campo do servidor aparece (para voltar ao passo certo em caso de erro).
const FIELD_STEP = { species: 0, breedId: 0, breedName: 0, adultKg: 0, name: 0, color: 0, ageYears: 1, ageMonths: 1, weightKg: 1, neutered: 1 };

const breedCache = {};
const loadBreeds = (species) => (breedCache[species] ??= api.breeds(species));

function emptyDraft() {
  return {
    species: null, breedId: null, breedName: '', adultKg: '', name: '', color: '', colorOther: '',
    ageYears: '', ageMonths: '', weightKg: '', neutered: true,
    monthlyPurchaseKg: '', dailyMode: 'recommended', customDailyGrams: '', stockKg: '', stockTouched: false,
    alertDays: 7, kcalPerKg: '',
  };
}

function draftFromPet(p) {
  const known = COLORS.includes(p.color);
  return {
    ...emptyDraft(),
    species: p.species, breedId: p.breedId, breedName: p.breedId.startsWith('outra') ? p.breedName : '',
    adultKg: p.breedId.startsWith('outra') ? String(p.adultKg) : '',
    name: p.name, color: known ? p.color : 'Outra', colorOther: known ? '' : p.color,
    ageYears: String(Math.floor(p.ageMonths / 12)), ageMonths: String(p.ageMonths % 12),
    weightKg: p.weightKg ? String(p.weightKg) : '', neutered: p.neutered,
    monthlyPurchaseKg: String(p.monthlyPurchaseKg),
    dailyMode: p.dailyMode, customDailyGrams: p.dailyMode === 'custom' ? String(p.dailyGrams) : '',
    alertDays: p.alertDays, kcalPerKg: p.kcalPerKg ? String(p.kcalPerKg) : '',
  };
}

const num = (v) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) && String(v).trim() !== '' ? n : null;
};

function createWizard({ navigate, editing }) {
  const draft = editing ? draftFromPet(editing) : emptyDraft();
  let step = 0;
  let breeds = [];
  let rec = null;
  let root;

  const color = () => (draft.color === 'Outra' ? draft.colorOther : draft.color);
  const isOther = () => draft.breedId?.startsWith('outra');
  const chosenBreed = () => breeds.find((b) => b.id === draft.breedId);
  const pressed = (on) => (on ? 'true' : 'false');

  // ---------- passo 1 ----------
  function step1() {
    const breed = chosenBreed();
    return html`
      <div class="field">
        <span class="label" id="lbl-species">É um…</span>
        <div class="species" role="group" aria-labelledby="lbl-species">
          <button type="button" data-species="dog" aria-pressed="${pressed(draft.species === 'dog')}"><span>🐶</span>Cachorro</button>
          <button type="button" data-species="cat" aria-pressed="${pressed(draft.species === 'cat')}"><span>🐱</span>Gato</button>
        </div>
        <span class="error" data-error-for="species" role="alert"></span>
      </div>
      ${draft.species
        ? html`
          ${field('name', 'Nome', html`<input class="input" name="name" value="${draft.name}" maxlength="40" autocomplete="off" />`)}
          <div class="field">
            <span class="label">Raça</span>
            ${breed
              ? html`<div class="row card" style="padding:12px 16px"><b class="grow">${breed.name}</b><button type="button" class="link" data-change-breed>Trocar</button></div>`
              : html`<input class="input" type="search" placeholder="Digite para buscar: lab, vira-lata, siamês…" data-breed-search autocomplete="off" aria-label="Buscar raça" />
                     <ul class="breed-list" data-breed-list></ul>`}
            <span class="error" data-error-for="breedId" role="alert"></span>
          </div>
          ${isOther()
            ? html`<div class="input-row">
                ${field('breedName', 'Qual raça?', html`<input class="input" name="breedName" value="${draft.breedName}" maxlength="60" />`)}
                ${field('adultKg', 'Peso adulto', html`<div class="unit" data-unit="kg"><input class="input" name="adultKg" inputmode="decimal" value="${draft.adultKg}" /></div>`)}
              </div>`
            : ''}
          <div class="field">
            <span class="label" id="lbl-color">Cor</span>
            <div class="chips" role="group" aria-labelledby="lbl-color">
              ${[...COLORS, 'Outra'].map((c) => html`<button type="button" class="chip" data-color="${c}" aria-pressed="${pressed(draft.color === c)}">${c}</button>`)}
            </div>
            ${draft.color === 'Outra' ? html`<input class="input" style="margin-top:10px" name="colorOther" value="${draft.colorOther}" placeholder="Qual cor?" maxlength="30" />` : ''}
            <span class="error" data-error-for="color" role="alert"></span>
          </div>`
        : ''}`;
  }

  function renderBreedList(query = '') {
    const list = root.querySelector('[data-breed-list]');
    if (!list) return;
    const q = normalizeText(query.trim());
    const found = breeds.filter((b) => !q || normalizeText(b.name).includes(q));
    list.innerHTML = found.length
      ? found.map((b) => html`<li><button type="button" data-breed="${b.id}">${b.name}</button></li>`).join('')
      : '<li class="empty">Não achou? Escolha "Outra raça" no fim da lista.</li>';
  }

  // ---------- passo 2 ----------
  function step2() {
    return html`
      <div class="field">
        <span class="label">Idade</span>
        <div class="input-row">
          <div class="unit" data-unit="anos"><input class="input" name="ageYears" inputmode="numeric" value="${draft.ageYears}" aria-label="Anos" /></div>
          <div class="unit" data-unit="meses"><input class="input" name="ageMonths" inputmode="numeric" value="${draft.ageMonths}" aria-label="Meses" /></div>
        </div>
        <span class="hint">Pode ser aproximada. Filhotes comem diferente de adultos, por isso a idade importa.</span>
        <span class="error" data-error-for="ageYears" role="alert"></span>
        <span class="error" data-error-for="ageMonths" role="alert"></span>
      </div>
      ${field('weightKg', 'Peso atual (opcional)', html`<div class="unit" data-unit="kg"><input class="input" name="weightKg" inputmode="decimal" value="${draft.weightKg}" placeholder="não sei" /></div>`, 'Se não souber, calculamos pela raça e idade. Informar o peso deixa a sugestão mais precisa.')}
      <div class="field">
        <span class="label" id="lbl-neutered">Castrado?</span>
        <div class="chips" role="group" aria-labelledby="lbl-neutered">
          <button type="button" class="chip" data-neutered="true" aria-pressed="${pressed(draft.neutered)}">Sim</button>
          <button type="button" class="chip" data-neutered="false" aria-pressed="${pressed(!draft.neutered)}">Não</button>
        </div>
        <span class="hint">Pets castrados gastam menos energia.</span>
      </div>`;
  }

  // ---------- passo 3 ----------
  function step3() {
    const r = rec;
    return html`
      <div class="card stack" style="background:var(--accent-soft);box-shadow:none" data-rec-card>
        <div class="row">
          <div class="avatar ${draft.species}" aria-hidden="true">${speciesEmoji(draft.species)}</div>
          <div class="grow">
            <div class="small muted">Sugestão para ${draft.name}</div>
            <b style="font-size:1.35rem" data-rec-main>${r ? `${fmtGrams(r.dailyGrams)} por dia` : '…'}</b>
            <div class="small muted" data-rec-sub>${r ? `${r.meals} refeições de ${fmtGrams(r.mealGrams)} · ≈ ${fmtKg(r.monthlyKg)} por mês` : ''}</div>
          </div>
        </div>
        <p class="small" style="color:var(--accent-text)">Referência de nutrição veterinária (NRC, AAHA, WSAVA). Confira também a tabela da embalagem.</p>
      </div>

      ${field('monthlyPurchaseKg', 'Quantos kg de ração você compra por mês?', html`<div class="unit" data-unit="kg"><input class="input" name="monthlyPurchaseKg" inputmode="decimal" value="${draft.monthlyPurchaseKg}" placeholder="ex.: 10" /></div>`)}
      <div class="chips" aria-label="Tamanhos de saco comuns">
        ${BAG_SIZES.map((kg) => html`<button type="button" class="chip" data-bag="${kg}">${fmtNumber(kg)} kg</button>`)}
      </div>
      <div data-compare></div>

      <div class="field">
        <span class="label" id="lbl-mode">Quanto ele come por dia?</span>
        <div class="stack" role="radiogroup" aria-labelledby="lbl-mode">
          <label class="radio"><input type="radio" name="dailyMode" value="recommended" ${draft.dailyMode === 'recommended' ? 'checked' : ''} /><div><b>Seguir a sugestão</b><span data-mode-rec>${r ? fmtGrams(r.dailyGrams) + ' por dia' : ''}</span></div></label>
          <label class="radio"><input type="radio" name="dailyMode" value="purchase" ${draft.dailyMode === 'purchase' ? 'checked' : ''} /><div><b>Pelo que eu compro</b><span data-mode-purchase>informe a compra mensal</span></div></label>
          <label class="radio"><input type="radio" name="dailyMode" value="custom" ${draft.dailyMode === 'custom' ? 'checked' : ''} /><div><b>Outra quantidade</b><span>Eu sei quanto dou</span></div></label>
        </div>
        <div data-custom ${draft.dailyMode === 'custom' ? '' : 'hidden'} style="margin-top:10px">
          ${field('customDailyGrams', 'Gramas por dia', html`<div class="unit" data-unit="g"><input class="input" name="customDailyGrams" inputmode="numeric" value="${draft.customDailyGrams}" /></div>`)}
        </div>
      </div>

      ${editing
        ? html`<div class="notice">Para corrigir quanto tem de ração em casa, use <b>Ajustar quanto tem em casa</b> na tela do pet.</div>`
        : field('stockKg', 'Quanto tem de ração em casa hoje?', html`<div class="unit" data-unit="kg"><input class="input" name="stockKg" inputmode="decimal" value="${draft.stockKg}" /></div>`, 'Se acabou de comprar, é a mesma quantidade da compra mensal.')}

      <label class="field">
        <span class="label">Avisar quando faltarem</span>
        <select class="input" name="alertDays">
          ${ALERT_OPTIONS.map((d) => html`<option value="${d}" ${Number(draft.alertDays) === d ? 'selected' : ''}>${d} dias</option>`)}
        </select>
        <span class="hint">Dá tempo de a loja separar e entregar a ração.</span>
      </label>

      <details>
        <summary>Opções avançadas</summary>
        ${field('kcalPerKg', 'Energia da ração (kcal/kg)', html`<input class="input" name="kcalPerKg" inputmode="numeric" value="${draft.kcalPerKg}" placeholder="ex.: 3800" />`, 'Está na embalagem como "Energia metabolizável". Se não souber, deixe em branco.')}
      </details>`;
  }

  // ---------- recomendação ao vivo ----------
  function recPayload() {
    return {
      species: draft.species, breedId: draft.breedId, adultKg: num(draft.adultKg) ?? undefined,
      ageYears: num(draft.ageYears) ?? 0, ageMonths: num(draft.ageMonths) ?? 0,
      weightKg: draft.weightKg, neutered: draft.neutered, kcalPerKg: draft.kcalPerKg,
    };
  }

  async function loadRecommendation() {
    try {
      rec = await api.recommend(recPayload());
    } catch (err) {
      rec = null;
      toast(err.message);
    }
    updateDynamic();
  }

  /** Atualiza só os textos que dependem da sugestão e da compra mensal (sem perder o foco). */
  function updateDynamic() {
    if (step !== 2 || !root) return;
    const set = (sel, text) => { const el = root.querySelector(sel); if (el) el.textContent = text; };
    if (rec) {
      set('[data-rec-main]', `${fmtGrams(rec.dailyGrams)} por dia`);
      set('[data-rec-sub]', `${rec.meals} refeições de ${fmtGrams(rec.mealGrams)} · ≈ ${fmtKg(rec.monthlyKg)} por mês`);
      set('[data-mode-rec]', `${fmtGrams(rec.dailyGrams)} por dia`);
    }
    const monthly = num(draft.monthlyPurchaseKg);
    set('[data-mode-purchase]', monthly ? `${fmtGrams(Math.round((monthly * 1000) / 30))} por dia (${fmtNumber(monthly)} kg ÷ 30 dias)` : 'informe a compra mensal');

    const box = root.querySelector('[data-compare]');
    if (!box) return;
    box.innerHTML = '';
    if (!rec || !monthly) return;
    const ratio = monthly / rec.monthlyKg;
    const text =
      ratio > 1.3 ? `Você compra ${fmtNumber(monthly)} kg por mês, mais que a sugestão (${fmtKg(rec.monthlyKg)}). Pode sobrar ração, ou ele pode estar comendo além do ideal.`
      : ratio < 0.7 ? `Você compra ${fmtNumber(monthly)} kg por mês, menos que a sugestão (${fmtKg(rec.monthlyKg)}). Confira se a porção dele é suficiente.`
      : '';
    if (text) box.innerHTML = html`<div class="notice warn" style="margin-top:10px">${text}</div>`.toString();

    if (!draft.stockTouched && !editing) {
      draft.stockKg = draft.monthlyPurchaseKg;
      const input = root.querySelector('[name=stockKg]');
      if (input) input.value = draft.stockKg;
    }
  }

  // ---------- navegação entre passos ----------
  function validate() {
    const bad = (msg, name, atStep = step) => { step = atStep; draw(); showError(root.querySelector('form'), { message: msg, field: name }); return false; };
    if (step === 0) {
      if (!draft.species) return bad('Escolha cachorro ou gato.', 'species');
      if (!draft.name.trim()) return bad('Qual é o nome dele?', 'name');
      if (!draft.breedId) return bad('Escolha a raça (ou vira-lata/SRD).', 'breedId');
      if (isOther() && num(draft.adultKg) === null) return bad('Informe o peso adulto aproximado.', 'adultKg');
      if (!color().trim()) return bad('Escolha a cor.', 'color');
    }
    if (step === 1 && num(draft.ageYears) === null && num(draft.ageMonths) === null) {
      return bad('Informe a idade (pode ser só os meses).', 'ageYears');
    }
    return true;
  }

  async function submit(button) {
    if (!draft.monthlyPurchaseKg) return showError(root.querySelector('form'), { message: 'Quanto você compra por mês?', field: 'monthlyPurchaseKg' });
    const payload = {
      species: draft.species, breedId: draft.breedId, breedName: draft.breedName, adultKg: num(draft.adultKg) ?? undefined,
      name: draft.name, color: color(),
      ageYears: num(draft.ageYears) ?? 0, ageMonths: num(draft.ageMonths) ?? 0,
      weightKg: draft.weightKg, neutered: draft.neutered, kcalPerKg: draft.kcalPerKg,
      monthlyPurchaseKg: draft.monthlyPurchaseKg, dailyMode: draft.dailyMode, customDailyGrams: draft.customDailyGrams,
      alertDays: Number(draft.alertDays),
      ...(editing ? {} : { stockKg: draft.stockKg || draft.monthlyPurchaseKg }),
    };
    await busy(button, async () => {
      try {
        const { pet } = editing ? await api.updatePet(editing.id, payload) : await api.createPet(payload);
        toast(editing ? 'Pet atualizado!' : `Pronto! Vamos cuidar da ração de ${pet.name}.`);
        navigate(`#/pet/${pet.id}`);
      } catch (err) {
        if (err.field in FIELD_STEP && FIELD_STEP[err.field] !== step) {
          step = FIELD_STEP[err.field];
          draw();
        }
        showError(root.querySelector('form'), err);
      }
    });
  }

  // ---------- desenho ----------
  function draw() {
    const body = [step1, step2, step3][step]();
    root.innerHTML = html`
      <div class="topbar">
        <button class="back" type="button" data-back aria-label="Voltar">‹</button>
        <h1>${editing ? `Editar ${editing.name}` : STEP_TITLES[step]}</h1>
      </div>
      <div class="steps" aria-label="Passo ${step + 1} de 3">${[0, 1, 2].map((i) => html`<i class="${i <= step ? 'done' : ''}"></i>`)}</div>
      <form class="stack" novalidate>
        ${body}
        <button class="btn block" type="submit" style="margin-top:22px">${step === 2 ? (editing ? 'Salvar alterações' : 'Concluir cadastro') : 'Continuar'}</button>
      </form>`.toString();
    if (step === 0 && draft.species && !chosenBreed()) renderBreedList(root.querySelector('[data-breed-search]')?.value);
    if (step === 2) {
      updateDynamic();
      if (!rec) loadRecommendation();
    }
  }

  const refreshRecommendation = debounce(loadRecommendation, 350);

  return {
    async mount(container) {
      root = container;
      if (draft.species) breeds = await loadBreeds(draft.species);
      draw();

      root.addEventListener('click', async (e) => {
        const t = e.target;
        const btn = (sel) => t.closest(sel);
        if (btn('[data-back]')) {
          if (step > 0) { step--; draw(); } else navigate('#/');
        } else if (btn('[data-species]')) {
          const species = btn('[data-species]').dataset.species;
          if (species !== draft.species) {
            Object.assign(draft, { species, breedId: null, breedName: '', adultKg: '' });
            breeds = await loadBreeds(species);
          }
          draw();
        } else if (btn('[data-breed]')) {
          draft.breedId = btn('[data-breed]').dataset.breed;
          draw();
        } else if (btn('[data-change-breed]')) {
          draft.breedId = null;
          draw();
          root.querySelector('[data-breed-search]')?.focus();
        } else if (btn('[data-color]')) {
          draft.color = btn('[data-color]').dataset.color;
          draw();
        } else if (btn('[data-neutered]')) {
          draft.neutered = btn('[data-neutered]').dataset.neutered === 'true';
          rec = null;
          draw();
        } else if (btn('[data-bag]')) {
          draft.monthlyPurchaseKg = btn('[data-bag]').dataset.bag;
          root.querySelector('[name=monthlyPurchaseKg]').value = draft.monthlyPurchaseKg;
          updateDynamic();
        }
      });

      root.addEventListener('input', (e) => {
        const el = e.target;
        if (el.matches('[data-breed-search]')) return renderBreedList(el.value);
        if (!el.name) return;
        if (el.name === 'dailyMode') {
          draft.dailyMode = el.value;
          root.querySelector('[data-custom]').hidden = el.value !== 'custom';
          return;
        }
        draft[el.name] = el.value;
        if (el.name === 'stockKg') draft.stockTouched = true;
        if (el.name === 'kcalPerKg') refreshRecommendation();
        if (el.name === 'monthlyPurchaseKg') updateDynamic();
      });

      root.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearErrors(e.target);
        if (!validate()) return;
        if (step < 2) {
          step++;
          if (step === 2) rec = null;
          draw();
          window.scrollTo(0, 0);
        } else {
          await submit(e.target.querySelector('[type=submit]'));
        }
      });
    },
  };
}

export async function create(ctx) {
  const wizard = createWizard({ navigate: ctx.navigate, editing: null });
  return { body: '<div data-wizard></div>', mount: (root) => wizard.mount(root.querySelector('[data-wizard]')) };
}

export async function edit(ctx) {
  const pet = ctx.app.me.pets.find((p) => p.id === Number(ctx.params[0]));
  if (!pet) {
    ctx.navigate('#/');
    return { body: '' };
  }
  const wizard = createWizard({ navigate: ctx.navigate, editing: pet });
  return { body: '<div data-wizard></div>', mount: (root) => wizard.mount(root.querySelector('[data-wizard]')) };
}
