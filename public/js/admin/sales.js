// Pedidos (do app e do balcão) e produtos.

import { icon, productTile } from '../icons.js';
import { brl, debounce, fmtDate, html, raw } from '../util.js';
import { busy, clearErrors, confirmSheet, control, field, sheet, showError } from '../ui.js';
import { call, species, toast } from './core.js';

const STATUS = { requested: 'Aguardando confirmação', confirmed: 'Confirmado', cancelled: 'Cancelado' };
let orderFilter = 'requested';

export async function orders({ refresh }) {
  const { orders: list } = await call('GET', `/orders${orderFilter === 'all' ? '' : `?status=${orderFilter}`}`);
  return {
    title: 'Pedidos',
    actions: html`<a class="btn btn--sm" href="#/pedidos/novo">${raw(icon('plus', 18))}Registrar venda</a>`,
    body: html`
      <div class="adm-filters">${[['requested', 'Do app, aguardando'], ['confirmed', 'Confirmados'], ['cancelled', 'Cancelados'], ['all', 'Todos']].map(([k, l]) => html`<button class="chip" data-filter="${k}" aria-pressed="${orderFilter === k}">${l}</button>`)}</div>
      <section class="adm-card"><div class="adm-table-wrap"><table class="adm-table">
        <thead><tr><th>Pedido</th><th>Cliente</th><th>Itens</th><th>Entrega</th><th>Origem</th><th class="num">Total</th><th>Situação</th><th></th></tr></thead>
        <tbody>${list.map((o) => html`<tr><td>#${o.id}<br /><span class="small muted">${fmtDate(o.createdAt)}</span></td>
          <td><a href="#/clientes/${o.customer.id}">${o.customer.name}</a>${o.petName ? html`<br /><span class="small muted">para ${o.petName}</span>` : ''}</td>
          <td>${o.items.map((l) => html`<div>${l.qty}× ${l.name}</div>`)}${o.couponCode ? html`<span class="small muted">Cupom ${o.couponCode}</span>` : ''}${o.pointsUsed ? html`<span class="small muted"> · ${o.pointsUsed} pontos usados</span>` : ''}</td>
          <td>${o.delivery === 'entrega' ? 'Entrega' : 'Retirada'}</td><td>${o.source === 'app' ? 'App' : 'Loja'}</td>
          <td class="num"><b>${brl(o.totalCents)}</b>${o.discountCents ? html`<br /><span class="small muted">−${brl(o.discountCents)}</span>` : ''}</td>
          <td><span class="badge badge--${o.status}">${STATUS[o.status]}</span></td>
          <td class="num">${o.status === 'requested' ? html`<button class="btn btn--sm" data-confirm="${o.id}">Confirmar</button> <button class="btn btn--sm btn--ghost" data-cancel="${o.id}">Recusar</button>`
            : o.status === 'confirmed' ? html`<button class="btn btn--sm btn--ghost" data-cancel="${o.id}">Estornar</button>` : ''}</td></tr>`)}</tbody>
      </table></div>${list.length ? '' : html`<p class="adm-empty">${orderFilter === 'requested' ? 'Nenhum pedido do app esperando. 🎉' : 'Nenhum pedido.'}</p>`}</section>
      <p class="small muted" style="margin-top:12px">Confirmar baixa o estoque, dá os pontos ao cliente e, se for ração, atualiza sozinho o estoque do pet no app.</p>`,
    mount(main) {
      main.addEventListener('click', async (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.filter) { orderFilter = b.dataset.filter; return refresh(); }
        if (b.dataset.confirm) {
          await busy(b, () => call('POST', `/orders/${b.dataset.confirm}/confirm`)).then(() => toast('Pedido confirmado. O cliente foi avisado.'), (err) => toast(err.message));
          return refresh();
        }
        if (b.dataset.cancel) {
          if (!(await confirmSheet({ title: `Cancelar o pedido #${b.dataset.cancel}?`, text: 'Pontos usados voltam ao cliente; se já estava confirmado, o estoque e os pontos ganhos são estornados.', confirmLabel: 'Cancelar pedido', danger: true }))) return;
          await call('POST', `/orders/${b.dataset.cancel}/cancel`).catch((err) => toast(err.message));
          refresh();
        }
      });
    },
  };
}

/** Venda no balcão: cliente, itens, pet, entrega, cupom e pontos, com o mesmo cálculo do app. */
export async function newOrder({ query, navigate }) {
  const [{ customers }, { products }] = await Promise.all([call('GET', '/customers'), call('GET', '/products')]);
  const active = products.filter((p) => p.active);
  const state = { customerId: Number(query.get('cliente')) || null, items: [], petId: null, delivery: 'retirada', usePoints: false, couponCode: '' };
  let detail = null;

  return {
    title: 'Registrar venda',
    actions: html`<a class="btn btn--sm btn--ghost" href="#/pedidos">${raw(icon('back', 18))}Pedidos</a>`,
    body: html`<form class="adm-grid adm-grid--2" novalidate>
      <section class="adm-card adm-form">
        <h2>Cliente e itens</h2>
        <div class="field"><label class="field__label" for="f-customerId">Cliente</label><div class="control"><select class="input" id="f-customerId" name="customerId">
          <option value="">Escolha…</option>${customers.map((c) => html`<option value="${c.id}" ${state.customerId === c.id ? 'selected' : ''}>${c.name}${c.member ? ' · Clube' : ''}</option>`)}</select></div>
          <span class="field__error" data-error-for="customerId"></span></div>
        <div class="field" data-pets></div>
        <div class="field"><label class="field__label" for="f-add">Adicionar produto</label><div class="control"><select class="input" id="f-add" name="add">
          <option value="">Escolha um produto…</option>${active.map((p) => html`<option value="${p.id}">${p.name} — ${brl(p.priceCents)}${p.stock !== null ? ` (${p.stock} em estoque)` : ''}</option>`)}</select></div></div>
        <div data-items></div>
        <span class="field__error" data-error-for="items"></span>
      </section>
      <section class="adm-card adm-form">
        <h2>Pagamento e entrega</h2>
        <div class="seg2"><button type="button" data-delivery="retirada" aria-pressed="true">${raw(icon('store', 18))}Retirada</button><button type="button" data-delivery="entrega" aria-pressed="false">${raw(icon('truck', 18))}Entrega</button></div>
        ${field('couponCode', 'Cupom (opcional)', control({ name: 'couponCode', placeholder: 'Ex.: VOLTA10' }))}
        <label class="inline" data-points hidden><input class="switch" type="checkbox" name="usePoints" /><span data-points-text></span></label>
        <div data-summary class="summary"><p class="muted small">Escolha o cliente e os produtos.</p></div>
        <button class="btn btn--block" type="submit">${raw(icon('check', 20))}Confirmar venda</button>
      </section></form>`,
    mount(main) {
      const form = main.querySelector('form');
      const itemsBox = form.querySelector('[data-items]');
      const drawItems = () => {
        itemsBox.innerHTML = state.items.map((it) => {
          const p = active.find((x) => x.id === it.productId);
          return html`<div class="adm-line">${raw(productTile(p, 22, 'ptile--sm'))}<span class="grow">${p.name}<br /><span class="small muted">${brl(p.priceCents)}</span></span>
            <div class="stepper"><button type="button" data-q="${p.id}:-1" aria-label="Menos">${raw(icon('minus', 16))}</button><output>${it.qty}</output><button type="button" data-q="${p.id}:1" aria-label="Mais">${raw(icon('plus', 16))}</button></div></div>`;
        }).join('');
      };
      const drawPets = () => {
        const pets = detail?.pets ?? [];
        form.querySelector('[data-pets]').innerHTML = pets.length > 1 ? html`<span class="field__label">Para qual pet (ração atualiza o estoque dele)</span><div class="chips">${pets.map((p) => html`<button type="button" class="chip" data-pet="${p.id}" aria-pressed="${state.petId === p.id}">${p.name}</button>`)}</div>`.toString() : '';
      };
      const quote = debounce(async () => {
        clearErrors(form);
        const box = form.querySelector('[data-summary]');
        if (!state.customerId || !state.items.length) { box.innerHTML = '<p class="muted small">Escolha o cliente e os produtos.</p>'; return; }
        try {
          const q = await call('POST', '/orders/quote', { ...state, couponCode: form.couponCode.value });
          box.innerHTML = html`<div><span>Subtotal</span><span>${brl(q.subtotal)}</span></div>
            ${q.clubDiscount ? html`<div class="off"><span>Clube Pet</span><span>−${brl(q.clubDiscount)}</span></div>` : ''}
            ${q.couponDiscount ? html`<div class="off"><span>Cupom</span><span>−${brl(q.couponDiscount)}</span></div>` : ''}
            ${q.pointsDiscount ? html`<div class="off"><span>${q.pointsUsed} pontos</span><span>−${brl(q.pointsDiscount)}</span></div>` : ''}
            ${q.delivery === 'entrega' ? html`<div><span>Entrega</span><span>${q.shipping ? brl(q.shipping) : 'Grátis'}</span></div>` : ''}
            <div class="total"><span>Total</span><span>${brl(q.total)}</span></div><div class="off"><span>Cliente ganha</span><span>${q.pointsEarned} pontos</span></div>`.toString();
          form.querySelector('[data-points]').hidden = !q.canUsePoints;
          form.querySelector('[data-points-text]').textContent = `Usar 50 dos ${q.pointsBalance} pontos (R$ 10)`;
        } catch (err) {
          if (err.field === 'usePoints') { state.usePoints = false; form.usePoints.checked = false; }
          showError(form, err);
        }
      }, 300);

      form.customerId.addEventListener('change', async () => {
        state.customerId = Number(form.customerId.value) || null;
        detail = state.customerId ? await call('GET', `/customers/${state.customerId}`) : null;
        state.petId = detail?.pets.length === 1 ? detail.pets[0].id : null;
        drawPets(); quote();
      });
      if (state.customerId) form.customerId.dispatchEvent(new Event('change'));
      form.add.addEventListener('change', () => {
        const id = Number(form.add.value);
        if (!id) return;
        const it = state.items.find((x) => x.productId === id);
        it ? it.qty++ : state.items.push({ productId: id, qty: 1 });
        form.add.value = '';
        drawItems(); quote();
      });
      form.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.q) {
          const [id, d] = b.dataset.q.split(':').map(Number);
          const it = state.items.find((x) => x.productId === id);
          it.qty += d;
          state.items = state.items.filter((x) => x.qty > 0);
          drawItems(); quote();
        }
        if (b.dataset.pet) { state.petId = Number(b.dataset.pet); drawPets(); quote(); }
        if (b.dataset.delivery) { state.delivery = b.dataset.delivery; form.querySelectorAll('[data-delivery]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); quote(); }
      });
      form.couponCode.addEventListener('input', quote);
      form.usePoints.addEventListener('change', () => { state.usePoints = form.usePoints.checked; quote(); });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        busy(form.querySelector('[type=submit]'), async () => {
          try {
            const { order } = await call('POST', '/orders', { ...state, couponCode: form.couponCode.value });
            toast(`Venda #${order.id} registrada: ${brl(order.totalCents)} · +${order.pointsEarned} pontos`);
            navigate(`#/clientes/${state.customerId}`);
          } catch (err) {
            showError(form, err);
          }
        });
      });
    },
  };
}

// ---------------- produtos ----------------

const TAGS_HELP = 'Perfil para a vitrine: grande, pequeno, resistente, filhote, senior, reposicao';

function productForm(p, categories, onSaved) {
  const v = p ?? { species: 'all', category: 'petisco', priceCents: 0, tags: [], active: true, clubDiscount: true, pointsMultiplier: 1 };
  const check = (name, label, on) => html`<label class="inline"><input class="switch" type="checkbox" name="${name}" ${on ? 'checked' : ''} />${label}</label>`;
  sheet(html`<form class="adm-form" novalidate>
      <h2>${p ? 'Editar produto' : 'Novo produto'}</h2>
      ${field('name', 'Nome', control({ name: 'name', value: v.name ?? '', maxlength: 80 }))}
      <div class="row2">
        <div class="field"><label class="field__label" for="f-category">Categoria</label><div class="control"><select class="input" id="f-category" name="category">${Object.entries(categories).map(([k, l]) => html`<option value="${k}" ${v.category === k ? 'selected' : ''}>${l}</option>`)}</select></div></div>
        <div class="field"><label class="field__label" for="f-species">Para</label><div class="control"><select class="input" id="f-species" name="species">${['all', 'dog', 'cat'].map((s) => html`<option value="${s}" ${v.species === s ? 'selected' : ''}>${species(s)}</option>`)}</select></div></div>
      </div>
      <div class="row2">
        ${field('priceCents', 'Preço (R$)', control({ name: 'priceCents', inputmode: 'decimal', value: ((v.priceCents ?? 0) / 100).toFixed(2).replace('.', ',') }))}
        ${field('stock', 'Estoque (vazio = sem controle)', control({ name: 'stock', inputmode: 'numeric', value: v.stock ?? '' }))}
      </div>
      <div class="row2">
        ${field('weightKg', 'Peso da ração (kg)', control({ name: 'weightKg', inputmode: 'decimal', value: v.weightKg ?? '' }), 'Repõe o estoque do pet na compra')}
        ${field('cycleDays', 'Duração (dias)', control({ name: 'cycleDays', inputmode: 'numeric', value: v.cycleDays ?? '' }), 'Como informado na embalagem')}
        ${field('pointsMultiplier', 'Pontos ×', control({ name: 'pointsMultiplier', inputmode: 'decimal', value: v.pointsMultiplier ?? 1 }), 'Mais pontos em itens de maior margem')}
      </div>
      ${field('tags', 'Etiquetas', control({ name: 'tags', value: (v.tags ?? []).join(', ') }), TAGS_HELP)}
      ${field('description', 'Descrição', control({ name: 'description', value: v.description ?? '', maxlength: 300 }))}
      <div class="row2">${check('featured', 'Destaque da semana', v.featured)}${check('isNew', 'Recém-chegado', v.isNew)}${check('membersOnly', 'Exclusivo do clube', v.membersOnly)}${check('clubDiscount', 'Desconto do clube', v.clubDiscount)}${check('active', 'À venda', v.active)}</div>
      <button class="btn btn--block" type="submit">Salvar</button><button class="btn btn--ghost btn--block" type="button" data-close>Cancelar</button>
    </form>`.toString(), {
    onMount(el, close) {
      el.querySelector('.sheet')?.classList.add('adm-sheet');
      const form = el.querySelector('form');
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        busy(form.querySelector('[type=submit]'), async () => {
          const body = {
            name: form.name.value, category: form.category.value, species: form.species.value, description: form.description.value,
            priceCents: Math.round(Number(form.priceCents.value.replace(/\./g, '').replace(',', '.')) * 100),
            stock: form.stock.value === '' ? null : form.stock.value, weightKg: form.weightKg.value || null, cycleDays: form.cycleDays.value || null,
            pointsMultiplier: form.pointsMultiplier.value || 1, tags: form.tags.value,
            featured: form.featured.checked, isNew: form.isNew.checked, membersOnly: form.membersOnly.checked, clubDiscount: form.clubDiscount.checked, active: form.active.checked,
          };
          try {
            await call(p ? 'PATCH' : 'POST', p ? `/products/${p.id}` : '/products', body);
            close(); toast('Produto salvo.'); onSaved();
          } catch (err) { showError(form, err); }
        });
      });
    },
  });
}

let catFilter = 'todas';
export async function products({ refresh }) {
  const { products: list, categories } = await call('GET', '/products');
  const shown = list.filter((p) => catFilter === 'todas' || p.category === catFilter);
  return {
    title: 'Produtos',
    actions: html`<button class="btn btn--sm" data-new>${raw(icon('plus', 18))}Novo produto</button>`,
    body: html`
      <p class="muted" style="margin:-10px 0 16px;font-weight:600">A vitrine do app escolhe os produtos pelo perfil de cada pet (espécie, porte, idade) e pelo histórico de compras. As etiquetas abaixo dizem para quem cada produto serve.</p>
      <div class="adm-filters"><button class="chip" data-cat="todas" aria-pressed="${catFilter === 'todas'}">Todas</button>${Object.entries(categories).filter(([k]) => list.some((p) => p.category === k)).map(([k, l]) => html`<button class="chip" data-cat="${k}" aria-pressed="${catFilter === k}">${l}</button>`)}</div>
      <section class="adm-card"><div class="adm-table-wrap"><table class="adm-table">
        <thead><tr><th>Produto</th><th>Para</th><th>Etiquetas</th><th class="num">Preço</th><th class="num">Clube</th><th class="num">Estoque</th><th>Vitrine</th></tr></thead>
        <tbody>${shown.map((p) => html`<tr data-edit="${p.id}" data-href="1"><td><div class="row">${raw(productTile(p, 20, 'ptile--sm'))}<span><b>${p.name}</b><br /><span class="small muted">${p.categoryLabel}${p.weightKg ? ` · ${p.weightKg} kg` : ''}${p.cycleDays ? ` · dura ${p.cycleDays} dias` : ''}</span></span></div></td>
          <td>${species(p.species)}</td><td class="small">${p.tags.join(', ') || '—'}</td><td class="num">${brl(p.priceCents)}</td><td class="num">${p.clubPriceCents ? brl(p.clubPriceCents) : '—'}</td>
          <td class="num" style="${p.stock !== null && p.stock <= 3 ? 'color:var(--danger-ink);font-weight:800' : ''}">${p.stock ?? '—'}</td>
          <td class="small">${[p.featured && 'Destaque', p.isNew && 'Novo', p.membersOnly && 'Exclusivo', p.pointsMultiplier > 1 && `${p.pointsMultiplier}× pontos`, !p.active && 'Fora de venda'].filter(Boolean).join(' · ') || '—'}</td></tr>`)}</tbody>
      </table></div></section>`,
    mount(main) {
      main.addEventListener('click', (e) => {
        const b = e.target.closest('[data-cat], [data-new], [data-edit]');
        if (!b) return;
        if (b.dataset.cat) { catFilter = b.dataset.cat; refresh(); }
        else if (b.matches('[data-new]')) productForm(null, categories, refresh);
        else productForm(list.find((p) => p.id === Number(b.dataset.edit)), categories, refresh);
      });
    },
  };
}
