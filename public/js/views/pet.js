import { api } from '../api.js';
import { icon } from '../icons.js';
import { fmtDate, fmtGrams, fmtIn, fmtKg, fmtNumber, html, nextMeal, raw } from '../util.js';
import { busy, confirmSheet, control, field, sheet, showError, toast } from '../ui.js';
import { heroCard } from './parts.js';

const STAGE = { puppy: 'filhote', adult: 'adulto', senior: 'sênior' };

/** "Comprei ração": soma ao que ainda tem em casa. */
export function restockSheet(pet, onDone) {
  sheet(
    html`<form class="stack" novalidate>
      <h2>Comprei ração para ${pet.name}</h2>
      ${field('kg', 'Quantos kg você comprou?', control({ name: 'kg', icon: 'bag', unit: 'kg', inputmode: 'decimal', value: fmtNumber(pet.monthlyPurchaseKg, 2) }), `Hoje tem ${fmtKg(pet.stock.kg)} em casa. O valor será somado.`)}
      <button class="btn btn--block" type="submit">Atualizar estoque</button>
      <button class="btn btn--ghost btn--block" type="button" data-close>Cancelar</button>
    </form>`.toString(),
    {
      onMount(el, close) {
        const form = el.querySelector('form');
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          await busy(form.querySelector('[type=submit]'), async () => {
            try {
              const { pet: updated } = await api.restock(pet.id, form.kg.value);
              close();
              toast(`Pronto! A ração de ${pet.name} dura até ${fmtDate(updated.stock.runsOutAt)}.`);
              onDone();
            } catch (err) {
              showError(form, err);
            }
          });
        });
      },
    },
  );
}

/** "Ajustar estoque": o tutor conferiu o saco e corrige o valor. */
function adjustSheet(pet, onDone) {
  sheet(
    html`<form class="stack" novalidate>
      <h2>Quanto tem de ração agora?</h2>
      ${field('kg', 'Quantidade em casa', control({ name: 'kg', icon: 'scale', unit: 'kg', inputmode: 'decimal', value: fmtNumber(pet.stock.kg, 2) }), 'Use quando conferir o saco e o valor do app estiver diferente.')}
      <button class="btn btn--block" type="submit">Salvar</button>
      <button class="btn btn--ghost btn--block" type="button" data-close>Cancelar</button>
    </form>`.toString(),
    {
      onMount(el, close) {
        const form = el.querySelector('form');
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          await busy(form.querySelector('[type=submit]'), async () => {
            try {
              await api.setStock(pet.id, form.kg.value);
              close();
              toast('Estoque ajustado.');
              onDone();
            } catch (err) {
              showError(form, err);
            }
          });
        });
      },
    },
  );
}

function routineCard(p) {
  const r = p.recommendation;
  const suggested = r.schedule;
  const next = nextMeal(p.mealTimes);
  const differs = suggested.meals !== p.mealsPerDay;
  return html`<section class="card stack" aria-labelledby="routine">
    <div class="row"><h2 id="routine" class="grow">Rotina de alimentação</h2><span class="badge">${p.mealsPerDay}× ao dia</span></div>
    <ul class="timeline">
      ${p.mealTimes.map(
        (t, i) => html`<li class="${i === next.index ? 'next' : ''}"><time>${t}</time><span class="g">${fmtGrams(p.mealGrams)}</span>${i === next.index ? html`<span class="badge tag">${fmtIn(next.inMin)}</span>` : ''}</li>`,
      )}
    </ul>
    ${differs
      ? html`<div class="notice notice--warn">${raw(icon('info', 18))}<span>Para ${p.breedName} ${STAGE[r.stage]}, o mais indicado é <b>${suggested.meals}× ao dia</b> (${suggested.times.join(', ')}). Você alimenta ${p.mealsPerDay}×.</span></div>`
      : ''}
    <ul class="tips">${suggested.tips.map((t) => html`<li>${raw(icon('check', 17))}<span>${t}</span></li>`)}</ul>
  </section>`;
}

function suggestionCard(p) {
  const r = p.recommendation;
  const ratio = p.dailyGrams / r.dailyGrams;
  let compare = null;
  if (p.dailyMode !== 'recommended' && ratio > 1.2) {
    compare = `Você está dando ${fmtGrams(p.dailyGrams)} por dia, ${Math.round((ratio - 1) * 100)}% a mais que a sugestão. Se ele estiver acima do peso, vale conversar com o veterinário.`;
  } else if (p.dailyMode !== 'recommended' && ratio < 0.8) {
    compare = `Você está dando ${fmtGrams(p.dailyGrams)} por dia, ${Math.round((1 - ratio) * 100)}% a menos que a sugestão. Confira se a porção é suficiente.`;
  }
  const weightNote =
    r.weightNote === 'above' ? 'O peso informado está acima do típico da raça. Pergunte ao veterinário qual é o peso ideal dele.'
    : r.weightNote === 'below' ? 'O peso informado está abaixo do típico da raça. Vale uma conversa com o veterinário.'
    : null;

  return html`<section class="card stack" aria-labelledby="sug">
    <h2 id="sug">Sugestão de porção</h2>
    <div class="row">
      <div class="badge-ic" style="display:grid;place-items:center;width:52px;height:52px;border-radius:18px;background:var(--orange-100);color:var(--orange-ink)">${raw(icon('bowl', 26))}</div>
      <div class="grow"><b class="display" style="font-size:1.5rem">${fmtGrams(r.dailyGrams)} por dia</b><div class="muted small">≈ ${fmtKg(r.monthlyKg)} por mês</div></div>
    </div>
    <p class="small muted">Para ${p.breedName}, ${STAGE[r.stage]}, ${fmtNumber(r.weightKg)} kg${r.weightEstimated ? ' (estimado pela raça e idade)' : ''}, ${p.neutered ? 'castrado' : 'não castrado'}. Calculada com as diretrizes de nutrição veterinária (NRC, AAHA e WSAVA).</p>
    ${compare ? html`<div class="notice notice--warn">${raw(icon('info', 18))}<span>${compare}</span></div>` : ''}
    ${weightNote ? html`<div class="notice notice--warn">${raw(icon('info', 18))}<span>${weightNote}</span></div>` : ''}
    <p class="small muted">É uma referência geral. A tabela da embalagem e o veterinário do seu pet têm a palavra final.</p>
  </section>`;
}

export async function detail({ app, params, navigate, refresh }) {
  const p = app.me.pets.find((x) => x.id === Number(params[0]));
  if (!p) {
    navigate('#/');
    return { body: '' };
  }
  const notice =
    p.stock.level === 'empty' ? ['danger', 'A ração acabou. A loja foi avisada e vai falar com você pelo WhatsApp.']
    : p.stock.level === 'low' ? ['warn', 'Está acabando. A loja foi avisada e vai falar com você pelo WhatsApp.']
    : null;

  return {
    body: html`
      <header class="pagehead">
        <a class="iconbtn" href="#/" aria-label="Voltar">${raw(icon('back', 22))}</a>
        <h1>${p.name}</h1>
        <a class="iconbtn" href="#/pet/${p.id}/editar" aria-label="Editar ${p.name}">${raw(icon('pencil', 20))}</a>
      </header>
      <div class="stack-lg">
        ${heroCard(p, {
          eyebrow: p.color,
          actions: html`${notice ? html`<div class="notice notice--${notice[0]}" role="status">${raw(icon('warn', 18))}<span>${notice[1]}</span></div>` : ''}
            <button class="btn btn--block" data-restock>Comprei ração</button>
            <button class="btn btn--on-dark btn--block" data-adjust>Ajustar quanto tem em casa</button>
            <p class="small muted center">Avisamos você e a loja quando faltarem ${p.alertDays} dias.</p>`,
        })}
        ${routineCard(p)}
        ${suggestionCard(p)}
        <button class="btn btn--danger btn--block" data-delete>${raw(icon('trash', 19))}Remover ${p.name}</button>
      </div>`,
    mount(root) {
      root.querySelector('[data-restock]').onclick = () => restockSheet(p, refresh);
      root.querySelector('[data-adjust]').onclick = () => adjustSheet(p, refresh);
      root.querySelector('[data-delete]').onclick = async () => {
        const yes = await confirmSheet({
          title: `Remover ${p.name}?`,
          text: 'O controle de ração e a rotina dele serão apagados. Isso não pode ser desfeito.',
          confirmLabel: 'Remover',
          danger: true,
        });
        if (!yes) return;
        try {
          await api.deletePet(p.id);
          toast(`${p.name} foi removido.`);
          navigate('#/');
        } catch (err) {
          toast(err.message);
        }
      };
    },
  };
}
