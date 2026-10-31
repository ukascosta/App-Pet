// Clube Pet: plano gratuito × assinatura. O pagamento é combinado com a loja.

import { api } from '../api.js';
import { icon } from '../icons.js';
import { brl, fmtDate, html, raw } from '../util.js';
import { busy, confirmSheet, toast } from '../ui.js';

export async function view({ refresh }) {
  const club = await api.club();
  const sub = club.subscription;
  const status = club.member
    ? html`<div class="notice">${raw(icon('check', 18))}<span>Você é do Clube Pet desde ${fmtDate(sub.startedAt)}. Próxima renovação: ${fmtDate(sub.renewsAt)}.</span></div>`
    : sub?.status === 'pending'
      ? html`<div class="notice notice--warn">${raw(icon('clock', 18))}<span>Pedido de assinatura enviado. A loja vai falar com você pelo WhatsApp para combinar o pagamento e ativar.</span></div>`
      : '';
  const list = (items) => html`<ul>${items.map((b) => html`<li>${raw(icon('check', 18))}<span>${b}</span></li>`)}</ul>`;

  return {
    tab: 'account',
    body: html`
      <header class="pagehead"><a class="iconbtn" href="#/" aria-label="Voltar">${raw(icon('back', 22))}</a><h1>Clube Pet</h1></header>
      <div class="stack-lg">
        <p class="muted" style="font-weight:600">Benefícios para quem cuida do pet com a gente todo mês.</p>
        ${status}
        <div class="plans">
          <section class="plan plan--club">
            <div class="row"><span style="color:var(--orange)">${raw(icon('crown', 26))}</span><h3 class="grow">Clube Pet</h3>${club.member ? html`<span class="badge">Seu plano</span>` : ''}</div>
            <div class="amount">${brl(club.priceCents)} <small>/mês</small></div>
            ${list(club.benefits.club)}
            ${club.member || sub?.status === 'pending' ? '' : html`<button class="btn btn--block" style="margin-top:18px" data-subscribe>Quero assinar</button>`}
          </section>
          <section class="plan">
            <div class="row"><h3 class="grow">Gratuito</h3>${club.member ? '' : html`<span class="badge">Seu plano</span>`}</div>
            <div class="amount">R$ 0</div>
            ${list(club.benefits.free)}
          </section>
        </div>
        <p class="disclaimer">${raw(icon('info', 16))}<span>Sem cobrança automática no app: a loja confirma a assinatura e a forma de pagamento com você. Cancele quando quiser.</span></p>
        ${club.member || sub?.status === 'pending' ? html`<button class="btn btn--ghost btn--block" data-cancel>${club.member ? 'Cancelar assinatura' : 'Desistir do pedido'}</button>` : ''}
      </div>`,
    mount(root) {
      root.querySelector('[data-subscribe]')?.addEventListener('click', (e) => busy(e.currentTarget, async () => {
        try {
          await api.subscribeClub();
          toast('Pedido enviado! A loja vai falar com você.');
          refresh();
        } catch (err) {
          toast(err.message);
        }
      }));
      root.querySelector('[data-cancel]')?.addEventListener('click', async () => {
        if (!(await confirmSheet({ title: 'Cancelar o Clube Pet?', text: 'Os descontos e a pontuação em dobro deixam de valer. Seus pontos continuam seus.', confirmLabel: 'Cancelar assinatura', danger: true }))) return;
        await api.cancelClub().catch((err) => toast(err.message));
        refresh();
      });
    },
  };
}
