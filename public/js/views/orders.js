// Minhas compras: o histórico vem da loja (balcão) e dos pedidos feitos no app.

import { api } from '../api.js';
import { icon } from '../icons.js';
import { brl, fmtDate, html, raw } from '../util.js';
import { confirmSheet, toast } from '../ui.js';

const STATUS = { requested: 'Aguardando a loja', confirmed: 'Confirmado', cancelled: 'Cancelado' };

export async function view({ refresh }) {
  const { orders } = await api.orders();
  return {
    tab: 'account',
    body: html`
      <header class="pagehead"><a class="iconbtn" href="#/conta" aria-label="Voltar">${raw(icon('back', 22))}</a><h1>Minhas compras</h1></header>
      ${orders.length
        ? html`<div>${orders.map((o) => html`<article class="card order">
            <div class="row"><b class="grow">Pedido #${o.id}</b><span class="badge badge--${o.status}">${STATUS[o.status]}</span></div>
            <div class="small muted">${fmtDate(o.createdAt)} · ${o.source === 'app' ? 'pelo app' : 'na loja'}${o.petName ? ` · para ${o.petName}` : ''}${o.delivery === 'entrega' ? ' · entrega' : ''}</div>
            <div class="lines">${o.items.map((l) => html`<div>${l.qty}× ${l.name}</div>`)}</div>
            <div class="row small"><b class="grow display" style="font-size:1.15rem">${brl(o.totalCents)}</b>
              ${o.pointsEarned && o.status !== 'cancelled' ? html`<span class="pill pill--mint">${raw(icon('star', 14))}+${o.pointsEarned}</span>` : ''}
              ${o.status === 'requested' ? html`<button class="btn btn--sm btn--ghost" data-cancel="${o.id}">Cancelar</button>` : ''}</div>
          </article>`)}</div>`
        : html`<section class="card empty"><p>Suas compras aparecem aqui assim que a loja registrar ou quando você pedir pelo app.</p><a class="btn" href="#/loja">${raw(icon('cart', 20))}Ir para a loja</a></section>`}`,
    mount(root) {
      root.querySelectorAll('[data-cancel]').forEach((b) => b.addEventListener('click', async () => {
        if (!(await confirmSheet({ title: `Cancelar o pedido #${b.dataset.cancel}?`, text: 'A loja ainda não confirmou. Se usou pontos, eles voltam para você.', confirmLabel: 'Cancelar pedido', danger: true }))) return;
        try {
          await api.cancelOrder(b.dataset.cancel);
          toast('Pedido cancelado.');
          refresh();
        } catch (err) {
          toast(err.message);
        }
      }));
    },
  };
}
