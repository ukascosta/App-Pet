// Pontos: saldo, trocas por recompensas, indicação de amigos e extrato.

import { api } from '../api.js';
import { icon } from '../icons.js';
import { brl, fmtDate, html, raw } from '../util.js';
import { busy, sheet, toast } from '../ui.js';

export async function view({ refresh }) {
  const pts = await api.points();
  const next = pts.rewards.filter((r) => r.costPoints > pts.balance).sort((a, b) => a.costPoints - b.costPoints)[0];
  const r = pts.rules;
  const issued = pts.redemptions.filter((x) => x.status === 'issued');

  return {
    tab: 'account',
    body: html`
      <header class="pagehead"><a class="iconbtn" href="#/" aria-label="Voltar">${raw(icon('back', 22))}</a><h1>Pontos</h1></header>
      <div class="stack-lg">
        <section class="card card--dark stack">
          <span class="eyebrow">Seu saldo</span>
          <div class="row" style="align-items:baseline"><b class="bigpoints">${pts.balance}</b><span class="muted" style="font-weight:700">pontos</span></div>
          ${next ? html`<div class="bar" style="--p:${Math.min(1, pts.balance / next.costPoints)};background:rgba(255,255,255,.14)" role="img" aria-label="Progresso até ${next.name}"><i></i></div>
            <p class="small muted">Faltam ${next.costPoints - pts.balance} pontos para: ${next.name}</p>` : ''}
          ${pts.expiringIn30Days ? html`<p class="small" style="color:var(--orange)">${pts.expiringIn30Days} pontos vencem nos próximos 30 dias.</p>` : ''}
        </section>

        ${issued.length ? html`<section class="card stack"><h2>Seus códigos</h2><p class="small muted">Mostre o código no caixa da loja.</p>
          ${issued.map((x) => html`<div class="row"><span class="code">${x.code}</span><span class="grow small">${x.name}</span></div>`)}</section>` : ''}

        <section class="card stack">
          <h2>Trocar pontos</h2>
          ${pts.rewards.map((rw) => html`<div class="reward"><span class="ptile ${rw.kind === 'gift' ? 'ptile--mint' : ''}">${raw(icon(rw.kind === 'gift' ? 'gift' : 'tag', 26))}</span>
            <div class="grow"><b>${rw.name}</b><div class="small muted">${rw.costPoints} pontos</div></div>
            <button class="btn btn--sm ${pts.balance >= rw.costPoints ? '' : 'btn--soft'}" data-redeem="${rw.id}" ${pts.balance >= rw.costPoints ? '' : 'disabled'}>Trocar</button></div>`)}
          <p class="small muted">Você também pode usar ${r.discountBlock} pontos como R$ ${r.discountCents / 100} de desconto direto em um pedido da loja.</p>
        </section>

        <section class="card card--soft stack">
          <div class="row"><span class="ptile ptile--pink">${raw(icon('users', 24))}</span><div class="grow"><h2>Indique um amigo</h2><p class="small" style="color:#6b3200">Ganhe ${r.referralPoints} pontos quando ele fizer a primeira compra.</p></div></div>
          <div class="row"><span class="code grow" style="text-align:center">${pts.referralCode}</span><button class="iconbtn" data-copy aria-label="Copiar código">${raw(icon('copy', 20))}</button></div>
          ${pts.referrals ? html`<p class="small">${pts.referrals} ${pts.referrals === 1 ? 'amigo usou' : 'amigos usaram'} seu código.</p>` : ''}
        </section>

        <section class="card stack">
          <h2>Como funciona</h2>
          <ul class="tips">
            <li>${raw(icon('check', 17))}<span>1 ponto a cada R$ ${r.reaisPerPoint} em compras confirmadas pela loja.</span></li>
            <li>${raw(icon('check', 17))}<span>Assinantes do Clube Pet ganham pontos em dobro (${r.clubMultiplier}×).</span></li>
            <li>${raw(icon('check', 17))}<span>Campanhas da loja podem dar pontos extras em alguns produtos.</span></li>
            <li>${raw(icon('check', 17))}<span>Os pontos valem por ${Math.round(r.validityDays / 30)} meses.</span></li>
          </ul>
        </section>

        <section class="card stack"><h2>Extrato</h2>
          ${pts.history.length ? html`<ul class="ledger">${pts.history.map((h) => html`<li><span>${h.reason}<br /><span class="small muted">${fmtDate(h.at)}</span></span><span class="${h.delta > 0 ? 'plus' : 'minus'}">${h.delta > 0 ? '+' : ''}${h.delta}</span></li>`)}</ul>`
            : html`<p class="muted small">Seus pontos aparecem aqui depois da primeira compra.</p>`}
        </section>
      </div>`,
    mount(root) {
      root.querySelectorAll('[data-redeem]').forEach((b) => b.addEventListener('click', () => busy(b, async () => {
        try {
          const res = await api.redeem(Number(b.dataset.redeem));
          sheet(html`<div class="stack center"><div class="ptile ptile--mint ptile--lg" style="margin:0 auto">${raw(icon('gift', 44))}</div>
            <h2>${res.name}</h2><p class="muted">Mostre este código no caixa da loja:</p><span class="code" style="margin:0 auto">${res.code}</span>
            <button class="btn btn--block" data-close>Pronto</button></div>`.toString(), { onClose: refresh });
        } catch (err) {
          toast(err.message);
        }
      })));
      root.querySelector('[data-copy]').addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(`Use meu código ${pts.referralCode} no cadastro do app PetLee.`);
          toast('Código copiado.');
        } catch {
          toast(`Seu código: ${pts.referralCode}`);
        }
      });
    },
  };
}
