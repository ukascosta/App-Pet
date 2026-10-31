// Loja: vitrine montada pelo perfil dos pets e pelo histórico de compras que a loja registra.

import { api } from '../api.js';
import { icon, productTile } from '../icons.js';
import { brl, debounce, html, raw } from '../util.js';
import { busy, sheet, toast } from '../ui.js';

/** Card compacto de produto (usado na loja e na tela inicial). */
export function productCard(p) {
  return html`<button class="pcard" type="button" data-product="${p.id}" aria-label="${p.name}">
    ${raw(productTile(p))}
    ${p.locked ? html`<span class="lock" title="Exclusivo do clube">${raw(icon('lock', 15))}</span>` : p.isNew ? html`<span class="flag">Novo</span>` : ''}
    <b>${p.name}</b>
    ${p.reason ? html`<span class="why">${p.reason}</span>` : ''}
    ${priceBlock(p)}
  </button>`;
}

function priceBlock(p, member = null) {
  if (p.clubPriceCents && member) return html`<span class="price"><s>${brl(p.priceCents)}</s>${brl(p.clubPriceCents)}<small>Preço de clube</small></span>`;
  return html`<span class="price">${brl(p.priceCents)}${p.clubPriceCents ? html`<small>${brl(p.clubPriceCents)} no Clube Pet</small>` : ''}</span>`;
}

const summaryRows = (q) => html`<div class="summary" aria-live="polite">
  <div><span>Subtotal</span><span>${brl(q.subtotal)}</span></div>
  ${q.clubDiscount ? html`<div class="off"><span>Desconto Clube Pet</span><span>− ${brl(q.clubDiscount)}</span></div>` : ''}
  ${q.couponDiscount ? html`<div class="off"><span>Cupom ${q.couponCode}</span><span>− ${brl(q.couponDiscount)}</span></div>` : ''}
  ${q.pointsDiscount ? html`<div class="off"><span>${q.pointsUsed} pontos</span><span>− ${brl(q.pointsDiscount)}</span></div>` : ''}
  ${q.delivery === 'entrega' ? html`<div class="${q.freeShipping ? 'off' : ''}"><span>Entrega</span><span>${q.shipping ? brl(q.shipping) : 'Grátis'}</span></div>` : ''}
  <div class="total"><span>Total</span><span>${brl(q.total)}</span></div>
  <div class="off"><span>${raw(icon('star', 15))} Você ganha</span><span>${q.pointsEarned} pontos${q.member ? ' (em dobro)' : ''}</span></div>
</div>`;

/** Janela do produto: quantidade, para qual pet, retirada/entrega, pontos, cupom e resumo calculado pela loja. */
export function productSheet(p, { pets = [], member = false, onDone } = {}) {
  if (p.locked) {
    return sheet(html`<div class="stack">
      <div class="row">${raw(productTile(p, 40, 'ptile--lg'))}<div class="grow"><span class="eyebrow">Exclusivo do Clube Pet</span><h2>${p.name}</h2></div></div>
      <p class="muted">Este produto é só para assinantes. Com o Clube Pet você também ganha desconto, frete grátis acima de R$ 150 e pontos em dobro.</p>
      <a class="btn btn--block btn--dark" href="#/clube" data-close>${raw(icon('crown', 20))}Conhecer o Clube Pet</a>
      <button class="btn btn--ghost btn--block" data-close>Fechar</button></div>`.toString());
  }
  const forSpecies = pets.filter((x) => p.species === 'all' || x.species === p.species);
  const state = { qty: 1, petId: forSpecies.length === 1 ? forSpecies[0].id : forSpecies[0]?.id ?? null, delivery: 'retirada', usePoints: false, couponCode: '' };

  return sheet(
    html`<form class="stack" novalidate>
      <div class="row">${raw(productTile(p, 40, 'ptile--lg'))}
        <div class="grow"><span class="eyebrow">${p.categoryLabel}</span><h2>${p.name}</h2>${p.reason ? html`<span class="badge" style="margin-top:6px">${p.reason}</span>` : ''}</div></div>
      ${p.description ? html`<p class="small muted">${p.description}</p>` : ''}
      <div class="row" style="justify-content:space-between">${priceBlock(p, member)}
        <div class="stepper" role="group" aria-label="Quantidade"><button type="button" data-qty="-1" aria-label="Menos">${raw(icon('minus', 18))}</button><output data-qty-out>1</output><button type="button" data-qty="1" aria-label="Mais">${raw(icon('plus', 18))}</button></div></div>
      ${forSpecies.length > 1 ? html`<div class="field"><span class="field__label">Para qual pet?</span><div class="chips">${forSpecies.map((x) => html`<button type="button" class="chip" data-pet="${x.id}" aria-pressed="${x.id === state.petId}">${x.name}</button>`)}</div>
        ${p.category === 'racao' ? html`<span class="field__hint">Quando a loja confirmar, o estoque de ração desse pet é atualizado sozinho.</span>` : ''}</div>` : ''}
      <div class="seg2" role="group" aria-label="Como receber">
        <button type="button" data-delivery="retirada" aria-pressed="true">${raw(icon('store', 18))}Retirar na loja</button>
        <button type="button" data-delivery="entrega" aria-pressed="false">${raw(icon('truck', 18))}Entrega</button>
      </div>
      <label class="toggle-row" data-points-row hidden><input class="switch" type="checkbox" name="usePoints" /><span class="grow small"><b>Usar pontos</b><br /><span class="muted" data-points-text></span></span></label>
      <details><summary>${raw(icon('tag', 18))}Tenho um cupom</summary>
        <div class="control"><input class="control__input" name="couponCode" placeholder="Código do cupom" autocomplete="off" style="text-transform:uppercase" /></div>
        <span class="field__error" data-error-for="couponCode" role="alert"></span></details>
      <div data-summary><div class="spinner" style="margin:10px auto"></div></div>
      <span class="field__error" data-error-for="items" role="alert"></span>
      <button class="btn btn--block" type="submit">${raw(icon('cart', 20))}Pedir à loja</button>
      <p class="disclaimer">${raw(icon('info', 16))}<span>O pagamento é feito na retirada ou na entrega. A loja confirma o pedido pelo WhatsApp.</span></p>
    </form>`.toString(),
    {
      onMount(el, close) {
        const form = el.querySelector('form');
        const payload = () => ({ items: [{ productId: p.id, qty: state.qty }], petId: state.petId, delivery: state.delivery, usePoints: state.usePoints, couponCode: state.couponCode });
        const setErr = (field, msg) => { const s = form.querySelector(`[data-error-for="${field}"]`); if (s) s.textContent = msg ?? ''; };

        const refresh = debounce(async () => {
          setErr('couponCode'); setErr('items');
          let q;
          try {
            q = await api.quote(payload());
          } catch (err) {
            if (err.field === 'couponCode') { setErr('couponCode', err.message); state.couponCode = ''; return refresh(); }
            if (err.field === 'usePoints') { state.usePoints = false; form.usePoints.checked = false; toast(err.message); return refresh(); }
            setErr('items', err.message);
            return;
          }
          form.querySelector('[data-summary]').innerHTML = summaryRows(q).toString();
          const row = form.querySelector('[data-points-row]');
          row.hidden = !q.canUsePoints;
          form.querySelector('[data-points-text]').textContent = `Você tem ${q.pointsBalance} pontos: use 50 e ganhe R$ 10 de desconto`;
        }, 250);
        refresh();

        form.addEventListener('click', (e) => {
          const t = e.target.closest('button');
          if (!t) return;
          if (t.dataset.qty) { state.qty = Math.min(20, Math.max(1, state.qty + Number(t.dataset.qty))); form.querySelector('[data-qty-out]').textContent = state.qty; refresh(); }
          if (t.dataset.pet) { state.petId = Number(t.dataset.pet); form.querySelectorAll('[data-pet]').forEach((b) => b.setAttribute('aria-pressed', String(b === t))); refresh(); }
          if (t.dataset.delivery) { state.delivery = t.dataset.delivery; form.querySelectorAll('[data-delivery]').forEach((b) => b.setAttribute('aria-pressed', String(b === t))); refresh(); }
        });
        form.usePoints.addEventListener('change', () => { state.usePoints = form.usePoints.checked; refresh(); });
        form.couponCode.addEventListener('input', debounce(() => { state.couponCode = form.couponCode.value.trim(); refresh(); }, 500));

        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          await busy(form.querySelector('[type=submit]'), async () => {
            try {
              const { order } = await api.order(payload());
              close();
              sheet(html`<div class="stack center">
                <div class="ptile ptile--mint ptile--lg" style="margin:0 auto">${raw(icon('check', 44))}</div>
                <h2>Pedido #${order.id} enviado</h2>
                <p class="muted">A loja recebeu seu pedido de ${brl(order.totalCents)} e vai confirmar com você pelo WhatsApp. Você também recebe o aviso aqui no app.</p>
                <a class="btn btn--block" href="#/compras" data-close>Ver minhas compras</a>
                <button class="btn btn--ghost btn--block" data-close>Continuar na loja</button></div>`.toString());
              onDone?.();
            } catch (err) {
              setErr(err.field === 'couponCode' ? 'couponCode' : 'items', err.message);
            }
          });
        });
      },
    },
  );
}

export async function view({ app }) {
  const [shop, summary] = await Promise.all([api.showcase(), api.summary()]);
  const { member, sections, pets } = shop;
  const all = sections.flatMap((s) => s.items);
  return {
    tab: 'shop',
    body: html`
      <header class="pagehead">
        <h1>Loja</h1>
        <a class="pill" href="#/pontos">${raw(icon('star', 16))}${summary.points} pontos</a>
      </header>
      ${member
        ? html`<a class="card card--dark row" href="#/clube" style="text-decoration:none;margin-bottom:18px">${raw(icon('crown', 26))}<div class="grow"><b>Você é do Clube Pet</b><div class="muted small">Preço de clube já aplicado, frete grátis acima de R$ 150 e pontos em dobro.</div></div></a>`
        : html`<a class="card card--soft row" href="#/clube" style="text-decoration:none;color:inherit;margin-bottom:18px"><span class="ptile ptile--butter">${raw(icon('crown', 26))}</span><div class="grow"><b>Clube Pet por ${brl(summary.clubPriceCents)}/mês</b><div class="small" style="color:#6b3200">5% em produtos, 10% no banho e tosa, frete grátis e pontos em dobro.</div></div>${raw(icon('next', 20))}</a>`}
      ${sections.length
        ? sections.map((s) => html`<section>
            <div class="section-title" style="margin-top:6px"><div><h2>${s.title}</h2>${s.subtitle ? html`<p class="small muted">${s.subtitle}</p>` : ''}</div></div>
            <div class="shelf">${s.items.map(productCard)}</div>
          </section>`)
        : html`<div class="card empty"><p>A loja ainda está montando a vitrine. Volte em breve!</p></div>`}`,
    mount(root) {
      // o <main> é recriado a cada tela (o #app não), então os cliques ficam presos a ele
      root.querySelector('main').addEventListener('click', (e) => {
        const card = e.target.closest('[data-product]');
        if (!card) return;
        const p = all.find((x) => x.id === Number(card.dataset.product));
        productSheet(p, { pets, member, onDone: () => {} });
      });
    },
  };
}
