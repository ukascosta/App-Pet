import { api } from '../api.js';
import { html, fmtAge, fmtDate, fmtDays, fmtGrams, fmtKg, fmtNumber, speciesEmoji } from '../util.js';
import { busy, confirmSheet, field, sheet, showError, toast } from '../ui.js';

const STAGE = { puppy: 'filhote', adult: 'adulto', senior: 'sênior' };

/** "Comprei ração": soma ao que ainda tem em casa. */
export function restockSheet(pet, onDone) {
  sheet(
    html`<form class="stack" novalidate>
      <h2>Comprei ração para ${pet.name}</h2>
      ${field('kg', 'Quantos kg você comprou?', html`<div class="unit" data-unit="kg"><input class="input" name="kg" inputmode="decimal" value="${fmtNumber(pet.monthlyPurchaseKg, 2)}" /></div>`, `Hoje tem ${fmtKg(pet.stock.kg)} em casa. O valor será somado.`)}
      <button class="btn block" type="submit">Atualizar estoque</button>
      <button class="btn ghost block" type="button" data-close>Cancelar</button>
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
      ${field('kg', 'Quantidade em casa', html`<div class="unit" data-unit="kg"><input class="input" name="kg" inputmode="decimal" value="${fmtNumber(pet.stock.kg, 2)}" /></div>`, 'Use quando conferir o saco e o valor do app estiver diferente.')}
      <button class="btn block" type="submit">Salvar</button>
      <button class="btn ghost block" type="button" data-close>Cancelar</button>
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

function suggestionCard(p) {
  const r = p.recommendation;
  const ratio = p.dailyGrams / r.dailyGrams;
  let compare = null;
  if (p.dailyMode !== 'recommended' && ratio > 1.2) {
    compare = ['warn', `Você está dando ${fmtGrams(p.dailyGrams)} por dia, ${Math.round((ratio - 1) * 100)}% a mais que a sugestão. Se ele estiver acima do peso, vale conversar com o veterinário.`];
  } else if (p.dailyMode !== 'recommended' && ratio < 0.8) {
    compare = ['warn', `Você está dando ${fmtGrams(p.dailyGrams)} por dia, ${Math.round((1 - ratio) * 100)}% a menos que a sugestão. Confira se a porção é suficiente.`];
  }
  const weightNote =
    r.weightNote === 'above'
      ? 'O peso informado está acima do típico da raça. Pergunte ao veterinário qual é o peso ideal dele.'
      : r.weightNote === 'below'
        ? 'O peso informado está abaixo do típico da raça. Vale uma conversa com o veterinário.'
        : null;

  return html`<section class="card stack" aria-labelledby="sug">
    <h2 id="sug">Sugestão de porção</h2>
    <div class="row">
      <div class="avatar" aria-hidden="true">🥣</div>
      <div class="grow">
        <b style="font-size:1.4rem">${fmtGrams(r.dailyGrams)} por dia</b>
        <div class="muted small">${r.meals} refeições de ${fmtGrams(r.mealGrams)} · ≈ ${fmtKg(r.monthlyKg)} por mês</div>
      </div>
    </div>
    <p class="small muted">
      Para ${p.breedName}, ${STAGE[r.stage]}, ${fmtNumber(r.weightKg)} kg${r.weightEstimated ? ' (estimado pela raça e idade)' : ''},
      ${p.neutered ? 'castrado' : 'não castrado'}. Calculada com as diretrizes de nutrição veterinária (NRC, AAHA e WSAVA).
    </p>
    ${compare ? html`<div class="notice warn">${compare[1]}</div>` : ''}
    ${weightNote ? html`<div class="notice warn">${weightNote}</div>` : ''}
    <p class="small muted">É uma referência geral. A tabela da embalagem e o veterinário do seu pet têm a palavra final.</p>
  </section>`;
}

export async function detail({ app, params, navigate, refresh }) {
  const p = app.me.pets.find((x) => x.id === Number(params[0]));
  if (!p) {
    navigate('#/');
    return { body: '' };
  }
  const { stock } = p;
  const days = Math.max(0, Math.floor(stock.daysLeft));
  const notice =
    stock.level === 'empty'
      ? ['danger', `A ração acabou. A loja foi avisada e vai falar com você pelo WhatsApp.`]
      : stock.level === 'low'
        ? ['warn', `Está acabando. A loja foi avisada e vai falar com você pelo WhatsApp.`]
        : null;

  return {
    body: html`
      <div class="topbar">
        <a class="back" href="#/" aria-label="Voltar">‹</a>
        <h1 class="grow">${p.name}</h1>
        <a class="btn small secondary" href="#/pet/${p.id}/editar">Editar</a>
      </div>
      <div class="stack">
        <section class="card stack">
          <div class="row">
            <div class="avatar big ${p.species}" aria-hidden="true">${speciesEmoji(p.species)}</div>
            <div class="grow">
              <h2>${p.breedName}</h2>
              <div class="muted small">${p.color} · ${fmtAge(p.ageMonths)}${p.weightKg ? ` · ${fmtNumber(p.weightKg)} kg` : ''}</div>
            </div>
          </div>
          <div class="ring ${stock.level}" style="--p:${stock.percent}" role="img" aria-label="${fmtDays(stock.daysLeft)} de ração">
            <svg viewBox="0 0 190 190" aria-hidden="true">
              <circle class="track" cx="95" cy="95" r="82" pathLength="1" />
              <circle class="value" cx="95" cy="95" r="82" pathLength="1" />
            </svg>
            <div class="label"><b>${days}</b><span>${days === 1 ? 'dia de ração' : 'dias de ração'}</span></div>
          </div>
          ${notice ? html`<div class="notice ${notice[0]}" role="status">${notice[1]}</div>` : ''}
          <div class="stats">
            <div class="stat"><b>${fmtKg(stock.kg)}</b><span>em casa agora</span></div>
            <div class="stat"><b>${stock.level === 'empty' ? 'Acabou' : fmtDate(stock.runsOutAt)}</b><span>previsão de término</span></div>
            <div class="stat"><b>${fmtGrams(p.dailyGrams)}</b><span>por dia</span></div>
            <div class="stat"><b>${fmtKg(p.monthlyPurchaseKg)}</b><span>compra mensal</span></div>
          </div>
          <button class="btn block" data-restock>Comprei ração</button>
          <button class="btn secondary block" data-adjust>Ajustar quanto tem em casa</button>
          <p class="small muted center">O app avisa você e a loja quando faltarem ${p.alertDays} dias.</p>
        </section>
        ${suggestionCard(p)}
        <button class="btn danger block" data-delete>Remover ${p.name}</button>
      </div>`,
    mount(root) {
      root.querySelector('[data-restock]').onclick = () => restockSheet(p, refresh);
      root.querySelector('[data-adjust]').onclick = () => adjustSheet(p, refresh);
      root.querySelector('[data-delete]').onclick = async () => {
        const yes = await confirmSheet({
          title: `Remover ${p.name}?`,
          text: 'O controle de ração dele será apagado. Isso não pode ser desfeito.',
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
