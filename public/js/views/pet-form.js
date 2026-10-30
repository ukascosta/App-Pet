// Cadastro/edição do pet em 4 passos: 1) quem é · 2) idade e peso · 3) ração · 4) rotina de refeições.

import { api } from '../api.js';
import { artSuccess, coatFor, speciesMark } from '../art.js';
import { icon } from '../icons.js';
import { debounce, fmtDate, fmtGrams, fmtKg, fmtNumber, html, normalizeText, raw } from '../util.js';
import { busy, clearErrors, control, field, showError, toast } from '../ui.js';

const COLORS = ['Preto', 'Branco', 'Caramelo', 'Marrom', 'Cinza', 'Dourado', 'Creme', 'Tigrado', 'Malhado', 'Tricolor', 'Preto e branco'];
const BAG_SIZES = [1, 3, 7, 10.1, 15, 20];
const ALERT_OPTIONS = [3, 5, 7, 10, 15];
const STEP_TITLES = ['Quem é o seu pet?', 'Idade e peso', 'A ração dele', 'Rotina de refeições'];
const STAGE = { puppy: 'filhote', adult: 'adulto', senior: 'sênior' };
// Em qual passo cada campo do servidor aparece (para voltar ao passo certo em caso de erro).
const FIELD_STEP = { species: 0, breedId: 0, breedName: 0, adultKg: 0, name: 0, color: 0, ageYears: 1, ageMonths: 1, weightKg: 1, neutered: 1, mealsPerDay: 3, mealTimes: 3 };

const breedCache = {};
const loadBreeds = (species) => (breedCache[species] ??= api.breeds(species));

function emptyDraft() {
  return {
    species: null, breedId: null, breedName: '', adultKg: '', name: '', color: '', colorOther: '',
    ageYears: '', ageMonths: '', weightKg: '', neutered: true,
    monthlyPurchaseKg: '', dailyMode: 'recommended', customDailyGrams: '', stockKg: '', stockTouched: false,
    alertDays: 7, kcalPerKg: '', mealsPerDay: null, mealTimes: [],
  };
}

function draftFromPet(p) {
  const known = COLORS.includes(p.color);
  const other = p.breedId.startsWith('outra');
  return {
    ...emptyDraft(),
    species: p.species, breedId: p.breedId, breedName: other ? p.breedName : '', adultKg: other ? String(p.adultKg) : '',
    name: p.name, color: known ? p.color : 'Outra', colorOther: known ? '' : p.color,
    ageYears: String(Math.floor(p.ageMonths / 12)), ageMonths: String(p.ageMonths % 12),
    weightKg: p.weightKg ? String(p.weightKg) : '', neutered: p.neutered,
    monthlyPurchaseKg: String(p.monthlyPurchaseKg),
    dailyMode: p.dailyMode, customDailyGrams: p.dailyMode === 'custom' ? String(p.dailyGrams) : '',
    alertDays: p.alertDays, kcalPerKg: p.kcalPerKg ? String(p.kcalPerKg) : '',
    mealsPerDay: p.mealsPerDay, mealTimes: [...p.mealTimes],
  };
}

const num = (v) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) && String(v).trim() !== '' ? n : null;
};

function createWizard({ app, navigate, editing }) {
  const draft = editing ? draftFromPet(editing) : emptyDraft();
  let step = 0;
  let breeds = [];
  let rec = null;
  let root;

  const color = () => (draft.color === 'Outra' ? draft.colorOther : draft.color);
  const isOther = () => draft.breedId?.startsWith('outra');
  const chosenBreed = () => breeds.find((b) => b.id === draft.breedId);
  const pressed = (on) => (on ? 'true' : 'false');
  const timesFor = (n) => [...app.config.feeding.times[n]];

  /** Gramas por dia com a opção de consumo escolhida (para mostrar quanto vai em cada refeição). */
  function dailyNow() {
    if (draft.dailyMode === 'custom') return num(draft.customDailyGrams) ?? rec?.dailyGrams ?? 0;
    if (draft.dailyMode === 'purchase') return ((num(draft.monthlyPurchaseKg) ?? 0) * 1000) / 30;
    return rec?.dailyGrams ?? 0;
  }

  // ---------- passo 1: quem é ----------
  function step1() {
    const breed = chosenBreed();
    return html`
      <div class="field">
        <span class="field__label" id="lbl-species">É um…</span>
        <div class="species" role="group" aria-labelledby="lbl-species">
          <button type="button" data-species="dog" aria-pressed="${pressed(draft.species === 'dog')}">${raw(speciesMark('dog'))}Cachorro</button>
          <button type="button" data-species="cat" aria-pressed="${pressed(draft.species === 'cat')}">${raw(speciesMark('cat'))}Gato</button>
        </div>
        <span class="field__error" data-error-for="species" role="alert"></span>
      </div>
      ${draft.species
        ? html`
          ${field('name', 'Nome', control({ name: 'name', icon: 'paw', value: draft.name, maxlength: 40, autocomplete: 'off', placeholder: 'Como ele se chama?' }))}
          <div class="field">
            <span class="field__label">Raça</span>
            ${breed
              ? html`<div class="card row" style="padding:12px 16px"><b class="grow">${breed.name}</b><button type="button" class="link" data-change-breed>Trocar</button></div>`
              : html`<div class="control">${html`<span class="control__icon">${raw(icon('sparkle', 20))}</span>`}<input class="control__input" type="search" placeholder="Busque: lab, vira-lata, siamês…" data-breed-search autocomplete="off" aria-label="Buscar raça" /></div>
                     <ul class="breed-list" data-breed-list></ul>`}
            <span class="field__error" data-error-for="breedId" role="alert"></span>
          </div>
          ${isOther()
            ? html`<div class="card card--soft stack">
                ${field('breedName', 'Qual raça?', control({ name: 'breedName', value: draft.breedName, maxlength: 60 }))}
                ${field('adultKg', 'Peso adulto aproximado', control({ name: 'adultKg', unit: 'kg', inputmode: 'decimal', value: draft.adultKg }))}
              </div>`
            : ''}
          <div class="field">
            <span class="field__label" id="lbl-color">Cor</span>
            <div class="chips" role="group" aria-labelledby="lbl-color">
              ${COLORS.map((c) => html`<button type="button" class="chip" data-color="${c}" aria-pressed="${pressed(draft.color === c)}"><i style="display:inline-block;width:12px;height:12px;border-radius:50%;margin-right:7px;vertical-align:-1px;background:${coatFor(c).fill};box-shadow:0 0 0 1.5px rgba(0,0,0,.25)"></i>${c}</button>`)}
              <button type="button" class="chip" data-color="Outra" aria-pressed="${pressed(draft.color === 'Outra')}">Outra</button>
            </div>
            ${draft.color === 'Outra' ? html`<div style="margin-top:10px">${control({ name: 'colorOther', value: draft.colorOther, placeholder: 'Qual cor?', maxlength: 30 })}</div>` : ''}
            <span class="field__error" data-error-for="color" role="alert"></span>
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

  // ---------- passo 2: idade e peso ----------
  function step2() {
    return html`
      <div class="field">
        <span class="field__label">Idade</span>
        <div class="row" style="align-items:stretch">
          <div class="grow">${control({ name: 'ageYears', icon: 'calendar', unit: 'anos', inputmode: 'numeric', value: draft.ageYears, 'aria-label': 'Anos', placeholder: '0' })}</div>
          <div class="grow">${control({ name: 'ageMonths', unit: 'meses', inputmode: 'numeric', value: draft.ageMonths, 'aria-label': 'Meses', placeholder: '0' })}</div>
        </div>
        <span class="field__hint">Pode ser aproximada. Filhotes comem diferente de adultos, por isso a idade importa.</span>
        <span class="field__error" data-error-for="ageYears" role="alert"></span>
        <span class="field__error" data-error-for="ageMonths" role="alert"></span>
      </div>
      ${field('weightKg', 'Peso atual (opcional)', control({ name: 'weightKg', icon: 'scale', unit: 'kg', inputmode: 'decimal', value: draft.weightKg, placeholder: 'não sei' }), 'Se não souber, calculamos pela raça e idade. Informar o peso deixa a sugestão mais precisa.')}
      <div class="field">
        <span class="field__label" id="lbl-neutered">Castrado?</span>
        <div class="chips" role="group" aria-labelledby="lbl-neutered">
          <button type="button" class="chip" data-neutered="true" aria-pressed="${pressed(draft.neutered)}">Sim</button>
          <button type="button" class="chip" data-neutered="false" aria-pressed="${pressed(!draft.neutered)}">Não</button>
        </div>
        <span class="field__hint">Pets castrados gastam menos energia.</span>
      </div>`;
  }

  // ---------- passo 3: ração ----------
  function step3() {
    const r = rec;
    return html`
      <div class="card card--mint stack">
        <div class="eyebrow" style="color:var(--mint-ink)">Sugestão para ${draft.name}</div>
        <div class="row"><b class="display grow" style="font-size:1.9rem" data-rec-main>${r ? `${fmtGrams(r.dailyGrams)} por dia` : '…'}</b></div>
        <div class="small" data-rec-sub style="font-weight:700">${r ? `≈ ${fmtKg(r.monthlyKg)} por mês` : ''}</div>
        <p class="small" style="color:#064e40">Referência de nutrição veterinária (NRC, AAHA, WSAVA). Confira também a tabela da embalagem.</p>
      </div>

      ${field('monthlyPurchaseKg', 'Quantos kg de ração você compra por mês?', control({ name: 'monthlyPurchaseKg', icon: 'bag', unit: 'kg', inputmode: 'decimal', value: draft.monthlyPurchaseKg, placeholder: 'ex.: 10' }))}
      <div class="chips" aria-label="Tamanhos de saco comuns" style="margin-top:12px">
        ${BAG_SIZES.map((kg) => html`<button type="button" class="chip" data-bag="${kg}">${fmtNumber(kg)} kg</button>`)}
      </div>
      <div data-compare></div>

      <div class="field">
        <span class="field__label" id="lbl-mode">Quanto ele come por dia?</span>
        <div class="stack" role="radiogroup" aria-labelledby="lbl-mode">
          <label class="radio"><input type="radio" name="dailyMode" value="recommended" ${draft.dailyMode === 'recommended' ? 'checked' : ''} /><div><b>Seguir a sugestão</b><span data-mode-rec>${r ? fmtGrams(r.dailyGrams) + ' por dia' : ''}</span></div></label>
          <label class="radio"><input type="radio" name="dailyMode" value="purchase" ${draft.dailyMode === 'purchase' ? 'checked' : ''} /><div><b>Pelo que eu compro</b><span data-mode-purchase>informe a compra mensal</span></div></label>
          <label class="radio"><input type="radio" name="dailyMode" value="custom" ${draft.dailyMode === 'custom' ? 'checked' : ''} /><div><b>Outra quantidade</b><span>Eu sei quanto dou</span></div></label>
        </div>
        <div data-custom ${draft.dailyMode === 'custom' ? '' : 'hidden'} style="margin-top:10px">
          ${field('customDailyGrams', 'Gramas por dia', control({ name: 'customDailyGrams', unit: 'g', inputmode: 'numeric', value: draft.customDailyGrams }))}
        </div>
      </div>

      ${editing
        ? html`<div class="notice">${raw(icon('info', 18))}<span>Para corrigir quanto tem de ração em casa, use <b>Ajustar quanto tem em casa</b> na tela do pet.</span></div>`
        : field('stockKg', 'Quanto tem de ração em casa hoje?', control({ name: 'stockKg', icon: 'scale', unit: 'kg', inputmode: 'decimal', value: draft.stockKg }), 'Se acabou de comprar, é a mesma quantidade da compra mensal.')}

      <div class="field">
        <label class="field__label" for="f-alertDays">Avisar quando faltarem</label>
        <div class="control"><select class="input" id="f-alertDays" name="alertDays">
          ${ALERT_OPTIONS.map((d) => html`<option value="${d}" ${Number(draft.alertDays) === d ? 'selected' : ''}>${d} dias</option>`)}
        </select></div>
        <span class="field__hint">Dá tempo de a loja separar e entregar a ração.</span>
      </div>

      <details>
        <summary>${raw(icon('next', 18))}Opções avançadas</summary>
        ${field('kcalPerKg', 'Energia da ração (kcal/kg)', control({ name: 'kcalPerKg', inputmode: 'numeric', value: draft.kcalPerKg, placeholder: 'ex.: 3800' }), 'Está na embalagem como "Energia metabolizável". Se não souber, deixe em branco.')}
      </details>`;
  }

  // ---------- passo 4: rotina de refeições ----------
  function step4() {
    const s = rec?.schedule;
    if (!s) return html`<div class="spinner" role="status"></div>`;
    const per = dailyNow() / draft.mealsPerDay;
    const stageText = STAGE[rec.stage];
    return html`
      <div class="card card--mint stack">
        <div class="eyebrow" style="color:var(--mint-ink)">Sugestão para ${chosenBreed()?.name ?? 'a raça'} ${stageText}</div>
        <div class="row"><b class="display grow" style="font-size:1.6rem">${s.meals}× ao dia</b>
          <button type="button" class="btn btn--sm btn--dark" data-use-suggestion>Usar sugestão</button></div>
        <div class="chips">${s.times.map((t) => html`<span class="badge" style="background:#fff">${raw(icon('clock', 14))}${t}</span>`)}</div>
        <ul class="tips">${s.tips.map((t) => html`<li>${raw(icon('check', 17))}<span>${t}</span></li>`)}</ul>
      </div>

      <div class="field">
        <span class="field__label" id="lbl-meals">Quantas vezes por dia você costuma alimentar?</span>
        <div class="seg" role="group" aria-labelledby="lbl-meals">
          ${[1, 2, 3, 4, 5, 6].map((n) => html`<button type="button" class="chip" data-meals="${n}" aria-pressed="${pressed(draft.mealsPerDay === n)}">${n}${n === s.meals ? html`<small>ideal</small>` : ''}</button>`)}
        </div>
        <span class="field__error" data-error-for="mealsPerDay" role="alert"></span>
      </div>

      <div class="field">
        <span class="field__label">Horários</span>
        <div class="stack">
          ${draft.mealTimes.map((t, i) => html`<div class="row"><span class="badge" style="min-width:34px;justify-content:center;background:var(--orange-100);color:var(--orange-ink)">${i + 1}</span>
            <div class="control grow"><input class="input" type="time" name="time-${i}" value="${t}" aria-label="Horário da refeição ${i + 1}" required /></div>
            <b class="nowrap small muted" style="min-width:56px;text-align:right">${fmtGrams(Math.round(per / 5) * 5)}</b></div>`)}
        </div>
        <span class="field__hint">A quantidade por refeição é a porção do dia dividida entre elas.</span>
        <span class="field__error" data-error-for="mealTimes" role="alert"></span>
      </div>`;
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
    if (step === 3) draw();
    else updateDynamic();
  }

  /** Atualiza só os textos que dependem da sugestão e da compra mensal (sem perder o foco). */
  function updateDynamic() {
    if (step !== 2 || !root) return;
    const set = (sel, text) => { const el = root.querySelector(sel); if (el) el.textContent = text; };
    if (rec) {
      set('[data-rec-main]', `${fmtGrams(rec.dailyGrams)} por dia`);
      set('[data-rec-sub]', `≈ ${fmtKg(rec.monthlyKg)} por mês`);
      set('[data-mode-rec]', `${fmtGrams(rec.dailyGrams)} por dia`);
    }
    const monthly = num(draft.monthlyPurchaseKg);
    set('[data-mode-purchase]', monthly ? `${fmtGrams(Math.round((monthly * 1000) / 30))} por dia (${fmtNumber(monthly)} kg ÷ 30 dias)` : 'informe a compra mensal');

    const box = root.querySelector('[data-compare]');
    if (!box) return;
    box.innerHTML = '';
    if (rec && monthly) {
      const ratio = monthly / rec.monthlyKg;
      const text =
        ratio > 1.3 ? `Você compra ${fmtNumber(monthly)} kg por mês, mais que a sugestão (${fmtKg(rec.monthlyKg)}). Pode sobrar ração, ou ele pode estar comendo além do ideal.`
        : ratio < 0.7 ? `Você compra ${fmtNumber(monthly)} kg por mês, menos que a sugestão (${fmtKg(rec.monthlyKg)}). Confira se a porção dele é suficiente.`
        : '';
      if (text) box.innerHTML = html`<div class="notice notice--warn" style="margin-top:6px">${raw(icon('info', 18))}<span>${text}</span></div>`.toString();
    }
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
    if (step === 2 && !draft.monthlyPurchaseKg) return bad('Quanto você compra por mês?', 'monthlyPurchaseKg');
    return true;
  }

  async function submit(button) {
    const times = [...root.querySelectorAll('input[type=time]')].map((i) => i.value);
    if (times.some((t) => !t)) return showError(root.querySelector('form'), { message: 'Informe o horário de cada refeição.', field: 'mealTimes' });
    draft.mealTimes = times;

    const payload = {
      species: draft.species, breedId: draft.breedId, breedName: draft.breedName, adultKg: num(draft.adultKg) ?? undefined,
      name: draft.name, color: color(),
      ageYears: num(draft.ageYears) ?? 0, ageMonths: num(draft.ageMonths) ?? 0,
      weightKg: draft.weightKg, neutered: draft.neutered, kcalPerKg: draft.kcalPerKg,
      monthlyPurchaseKg: draft.monthlyPurchaseKg, dailyMode: draft.dailyMode, customDailyGrams: draft.customDailyGrams,
      alertDays: Number(draft.alertDays), mealsPerDay: draft.mealsPerDay, mealTimes: draft.mealTimes,
      ...(editing ? {} : { stockKg: draft.stockKg || draft.monthlyPurchaseKg }),
    };
    await busy(button, async () => {
      try {
        const { pet } = editing ? await api.updatePet(editing.id, payload) : await api.createPet(payload);
        if (editing) {
          toast('Pet atualizado!');
          navigate(`#/pet/${pet.id}`);
        } else {
          drawSuccess(pet);
        }
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
  /** Ao chegar na rotina pela primeira vez, começa pela sugestão da raça (ao editar, mantém a do tutor). */
  function ensureMeals() {
    if (rec && !draft.mealsPerDay) {
      draft.mealsPerDay = rec.schedule.meals;
      draft.mealTimes = [...rec.schedule.times];
    }
  }

  function draw() {
    if (step === 3) ensureMeals();
    const body = [step1, step2, step3, step4][step]();
    root.innerHTML = html`
      <header class="pagehead">
        <button class="iconbtn" type="button" data-back aria-label="Voltar">${raw(icon('back', 22))}</button>
        <h1>${editing ? `Editar ${editing.name}` : 'Novo pet'}</h1>
      </header>
      <div class="steps" role="img" aria-label="Passo ${step + 1} de 4">${[0, 1, 2, 3].map((i) => html`<i class="${i <= step ? 'done' : ''}"></i>`)}</div>
      <div class="wiz-title"><div class="eyebrow">Passo ${step + 1} de 4</div><h1>${STEP_TITLES[step]}</h1></div>
      <form class="stack-lg" novalidate>
        ${body}
        <button class="btn btn--block" type="submit">${step === 3 ? (editing ? 'Salvar alterações' : 'Concluir cadastro') : 'Continuar'}</button>
      </form>`.toString();
    if (step === 0 && draft.species && !chosenBreed()) renderBreedList(root.querySelector('[data-breed-search]')?.value);
    if (step === 2) {
      updateDynamic();
      if (!rec) loadRecommendation();
    }
    if (step === 3 && !rec) loadRecommendation();
  }

  function drawSuccess(pet) {
    root.innerHTML = html`<section class="empty stack-lg" style="padding-top:24px">
      ${raw(artSuccess(pet.species))}
      <div class="stack">
        <h1>${pet.name} está cadastrado!</h1>
        <p style="margin:0 auto">A ração dura até <b>${fmtDate(pet.stock.runsOutAt)}</b>. Avisamos você e a loja quando faltarem ${pet.alertDays} dias.</p>
      </div>
      <div class="card card--soft" style="text-align:left">
        <div class="row" style="justify-content:space-around">
          <div class="center"><b class="display" style="font-size:1.4rem">${fmtGrams(pet.dailyGrams)}</b><div class="small muted">por dia</div></div>
          <div class="center"><b class="display" style="font-size:1.4rem">${pet.mealsPerDay}×</b><div class="small muted">refeições</div></div>
          <div class="center"><b class="display" style="font-size:1.4rem">${pet.mealTimes[0]}</b><div class="small muted">primeira</div></div>
        </div>
      </div>
      <div class="stack"><a class="btn btn--block" href="#/pet/${pet.id}">Ver ${pet.name}</a>
        <a class="btn btn--soft btn--block" href="#/novo-pet" data-another>Adicionar outro pet</a></div>
    </section>`.toString();
    // já estamos em #/novo-pet: em vez de recarregar a página, pede ao roteador para desenhar o assistente de novo
    root.querySelector('[data-another]').addEventListener('click', (e) => {
      e.preventDefault();
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
  }

  const refreshRecommendation = debounce(() => { rec = null; loadRecommendation(); }, 350);

  return {
    async mount(container) {
      root = container;
      if (draft.species) breeds = await loadBreeds(draft.species);
      draw();

      root.addEventListener('click', async (e) => {
        const t = e.target;
        const btn = (sel) => t.closest(sel);
        if (btn('[data-back]')) {
          if (step > 0) { step--; draw(); } else navigate(editing ? `#/pet/${editing.id}` : '#/');
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
        } else if (btn('[data-meals]')) {
          draft.mealsPerDay = Number(btn('[data-meals]').dataset.meals);
          draft.mealTimes = timesFor(draft.mealsPerDay);
          draw();
        } else if (btn('[data-use-suggestion]')) {
          draft.mealsPerDay = rec.schedule.meals;
          draft.mealTimes = [...rec.schedule.times];
          draw();
        }
      });

      root.addEventListener('input', (e) => {
        const el = e.target;
        if (el.matches('[data-breed-search]')) return renderBreedList(el.value);
        if (!el.name) return;
        if (el.name.startsWith('time-')) return void (draft.mealTimes[Number(el.name.slice(5))] = el.value);
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
        if (step < 3) {
          step++;
          if (step === 2) rec = null; // idade/peso/castração podem ter mudado
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
  const wizard = createWizard({ app: ctx.app, navigate: ctx.navigate, editing: null });
  return { body: '<div data-wizard></div>', mount: (root) => wizard.mount(root.querySelector('[data-wizard]')) };
}

export async function edit(ctx) {
  const pet = ctx.app.me.pets.find((p) => p.id === Number(ctx.params[0]));
  if (!pet) {
    ctx.navigate('#/');
    return { body: '' };
  }
  const wizard = createWizard({ app: ctx.app, navigate: ctx.navigate, editing: pet });
  return { body: '<div data-wizard></div>', mount: (root) => wizard.mount(root.querySelector('[data-wizard]')) };
}
