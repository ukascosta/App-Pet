// Pontos, campanhas, cupons, recompensas, notificações segmentadas e configurações.

import { icon } from '../icons.js';
import { brl, fmtDate, html, raw } from '../util.js';
import { busy, control, field, showError } from '../ui.js';
import { call, kpi, toast } from './core.js';

const KIND = { categoria: 'Categoria', produto: 'Produto', aniversario: 'Mês de aniversário do pet', recorrente: 'Clientes recorrentes (3+ compras)' };
const money = (v) => Math.round(Number(String(v).replace(/\./g, '').replace(',', '.')) * 100) || 0;

export async function marketing({ refresh }) {
  const [m, { products, categories }] = await Promise.all([call('GET', '/marketing'), call('GET', '/products')]);
  const sel = (name, options, value = '') => html`<div class="control"><select class="input" id="f-${name}" name="${name}">${options.map(([v, l]) => html`<option value="${v}" ${v === value ? 'selected' : ''}>${l}</option>`)}</select></div>`;
  return {
    title: 'Pontos e campanhas',
    body: html`<div class="adm-grid">
      <div class="adm-grid adm-grid--kpi">${kpi('Pontos em circulação', m.pointsIssued, 'Ainda dentro da validade')}${kpi('Campanhas rodando', m.campaigns.filter((c) => c.running).length)}${kpi('Cupons ativos', m.coupons.filter((c) => c.active).length)}${kpi('Trocas a entregar', m.redemptions.filter((r) => r.status === 'issued').length, 'Códigos emitidos')}</div>
      <div class="adm-grid adm-grid--2">
        <section class="adm-card"><h2>${raw(icon('star', 20))}Campanhas de pontos</h2>
          ${m.campaigns.map((c) => html`<div class="adm-line"><span class="grow"><b>${c.name}</b><br /><span class="small muted">${KIND[c.kind]}${c.category ? `: ${categories[c.category]}` : ''}${c.productId ? `: ${products.find((p) => p.id === c.productId)?.name ?? ''}` : ''} · ${c.multiplier}× pontos${c.endsAt ? ` · até ${fmtDate(c.endsAt)}` : ''}</span></span>
            ${c.running ? html`<span class="st st--won">Rodando</span>` : html`<span class="st">${c.active ? 'Agendada' : 'Pausada'}</span>`}<button class="btn btn--sm btn--ghost" data-campaign="${c.id}" data-active="${c.active ? 0 : 1}">${c.active ? 'Pausar' : 'Ativar'}</button></div>`)}
          <form class="adm-form" data-form="campaign" style="margin-top:14px" novalidate>
            ${field('name', 'Nova campanha', control({ name: 'name', placeholder: 'Ex.: Pontos em dobro na ração' }))}
            <div class="row2"><div class="field"><label class="field__label" for="f-kind">Vale para</label>${sel('kind', Object.entries(KIND))}</div>
              <div class="field"><label class="field__label" for="f-category">Categoria</label>${sel('category', Object.entries(categories), 'racao')}</div>
              <div class="field"><label class="field__label" for="f-productId">Produto</label>${sel('productId', products.map((p) => [String(p.id), p.name]))}</div></div>
            <div class="row2">${field('multiplier', 'Multiplicador', control({ name: 'multiplier', value: '2', inputmode: 'decimal' }))}${field('endsAt', 'Termina em', html`<div class="control"><input class="control__input" id="f-endsAt" type="date" name="endsAt" /></div>`)}</div>
            <button class="btn btn--sm" type="submit">Criar campanha</button>
            <p class="small muted">Prefira dar pontos extras em produtos de maior margem; os pontos têm custo e validade.</p></form></section>

        <section class="adm-card"><h2>${raw(icon('tag', 20))}Cupons</h2>
          ${m.coupons.map((c) => html`<div class="adm-line"><span class="grow"><b>${c.code}</b> · ${c.percent ? `${c.percent}%` : brl(c.valueCents)}${c.minCents ? ` acima de ${brl(c.minCents)}` : ''}<br /><span class="small muted">${c.description ?? ''}${c.membersOnly ? ' · só clube' : ''} · ${c.uses}${c.maxUses ? `/${c.maxUses}` : ''} usos${c.endsAt ? ` · até ${fmtDate(c.endsAt)}` : ''}</span></span>
            <button class="btn btn--sm btn--ghost" data-coupon="${c.id}" data-active="${c.active ? 0 : 1}">${c.active ? 'Desativar' : 'Ativar'}</button></div>`)}
          <form class="adm-form" data-form="coupon" style="margin-top:14px" novalidate>
            <div class="row2">${field('code', 'Código', control({ name: 'code', placeholder: 'NATAL10' }))}${field('percent', 'Desconto %', control({ name: 'percent', inputmode: 'numeric', placeholder: '10' }))}${field('value', 'ou R$', control({ name: 'value', inputmode: 'decimal', placeholder: '15,00' }))}</div>
            <div class="row2">${field('min', 'Compra mínima (R$)', control({ name: 'min', inputmode: 'decimal', placeholder: '100,00' }))}${field('maxUses', 'Limite de usos', control({ name: 'maxUses', inputmode: 'numeric' }))}${field('endsAt', 'Válido até', html`<div class="control"><input class="control__input" type="date" name="endsAt" /></div>`)}</div>
            ${field('description', 'Descrição', control({ name: 'description', placeholder: 'Para quem é este cupom' }))}
            <label class="inline"><input class="switch" type="checkbox" name="membersOnly" />Só para o Clube Pet</label>
            <button class="btn btn--sm" type="submit">Criar cupom</button></form></section>

        <section class="adm-card"><h2>${raw(icon('gift', 20))}Recompensas</h2>
          ${m.rewards.map((r) => html`<div class="adm-line"><span class="grow"><b>${r.name}</b><br /><span class="small muted">${r.costPoints} pontos · ${r.kind === 'gift' ? 'brinde' : `desconto de ${brl(r.valueCents)}`}</span></span>
            <button class="btn btn--sm btn--ghost" data-reward="${r.id}" data-active="${r.active ? 0 : 1}">${r.active ? 'Desativar' : 'Ativar'}</button></div>`)}
          <form class="adm-form" data-form="reward" style="margin-top:14px" novalidate>
            <div class="row2">${field('name', 'Nova recompensa', control({ name: 'name', placeholder: 'Ex.: Banho grátis' }))}${field('costPoints', 'Pontos', control({ name: 'costPoints', inputmode: 'numeric', placeholder: '150' }))}</div>
            <div class="row2"><div class="field"><label class="field__label" for="f-rkind">Tipo</label>${sel('rkind', [['gift', 'Brinde'], ['discount', 'Desconto']])}</div>${field('value', 'Valor (R$)', control({ name: 'value', inputmode: 'decimal', placeholder: '10,00' }))}</div>
            <button class="btn btn--sm" type="submit">Criar recompensa</button></form>
          <form class="adm-form" data-form="redeem" style="margin-top:18px;padding-top:14px;border-top:1px solid var(--line)" novalidate>
            ${field('code', 'Dar baixa em código de troca', control({ name: 'code', placeholder: 'R-ABC123', icon: 'check' }), 'O cliente mostra o código no app')}
            <button class="btn btn--sm btn--dark" type="submit">Dar baixa</button></form>
          ${m.redemptions.length ? html`<div style="margin-top:12px">${m.redemptions.slice(0, 6).map((r) => html`<div class="adm-line small"><span class="grow"><b>${r.code}</b> · ${r.name} · ${r.customer}</span><span class="st ${r.status === 'used' ? 'st--won' : 'st--contacted'}">${r.status === 'used' ? 'Entregue' : 'A entregar'}</span></div>`)}</div>` : ''}</section>

        <section class="adm-card"><h2>${raw(icon('megaphone', 20))}Notificação segmentada</h2>
          <form class="adm-form" data-form="broadcast" novalidate>
            <div class="row2"><div class="field"><label class="field__label" for="f-species">Tutores de</label>${sel('species', [['all', 'Todos os pets'], ['dog', 'Cães'], ['cat', 'Gatos']])}</div>
              <div class="field"><label class="field__label" for="f-audience">Público</label>${sel('audience', [['all', 'Todos'], ['club', 'Só Clube Pet'], ['non-club', 'Quem não assina']])}</div></div>
            ${field('title', 'Título', control({ name: 'title', placeholder: 'Semana do gato', maxlength: 60 }))}
            ${field('body', 'Mensagem', control({ name: 'body', placeholder: 'Areia e sachês com 10% até domingo.', maxlength: 300 }))}
            <button class="btn btn--sm" type="submit">Enviar no app</button>
            <p class="small muted">Chega como aviso no app (e push, se o tutor ativou) para quem autorizou contato.</p></form>
          ${m.broadcasts.map((b) => html`<div class="adm-line small"><span class="grow"><b>${b.title}</b> · ${b.body}</span><span class="muted">${b.sentCount} tutores · ${fmtDate(b.createdAt)}</span></div>`)}</section>
      </div></div>`,
    mount(main) {
      main.addEventListener('click', async (e) => {
        const b = e.target.closest('button[data-active]');
        if (!b) return;
        const path = b.dataset.campaign ? `/campaigns/${b.dataset.campaign}` : b.dataset.coupon ? `/coupons/${b.dataset.coupon}` : `/rewards/${b.dataset.reward}`;
        await call('PATCH', path, { active: b.dataset.active === '1' }).catch((err) => toast(err.message));
        refresh();
      });
      main.addEventListener('submit', (e) => {
        e.preventDefault();
        const f = e.target;
        const send = {
          campaign: () => call('POST', '/campaigns', { name: f.name.value, kind: f.kind.value, category: f.category.value, productId: f.productId.value, multiplier: f.multiplier.value.replace(',', '.'), endsAt: f.endsAt.value ? `${f.endsAt.value}T23:59:00` : undefined }),
          coupon: () => call('POST', '/coupons', { code: f.code.value, percent: f.percent.value || 0, valueCents: money(f.value.value), minCents: money(f.min.value), maxUses: f.maxUses.value || undefined, endsAt: f.endsAt.value ? `${f.endsAt.value}T23:59:00` : undefined, description: f.description.value, membersOnly: f.membersOnly.checked }),
          reward: () => call('POST', '/rewards', { name: f.name.value, costPoints: f.costPoints.value, kind: f.rkind.value, valueCents: money(f.value.value) }),
          redeem: () => call('POST', `/redemptions/${encodeURIComponent(f.code.value.trim())}/use`),
          broadcast: () => call('POST', '/broadcasts', { species: f.species.value, audience: f.audience.value, title: f.title.value, body: f.body.value }),
        }[f.dataset.form];
        busy(f.querySelector('[type=submit]'), async () => {
          try {
            const r = await send();
            toast(f.dataset.form === 'broadcast' ? `Enviada para ${r.sent} tutores.` : f.dataset.form === 'redeem' ? `Baixa feita: ${r.name}.` : 'Salvo.');
            refresh();
          } catch (err) { showError(f, err); }
        });
      });
    },
  };
}

const SETTINGS = [
  ['clubPriceCents', 'Mensalidade do Clube Pet', 'R$', 'money'],
  ['clubProductDiscount', 'Desconto do clube em produtos', '%'],
  ['clubServiceDiscount', 'Desconto do clube em banho e tosa', '%'],
  ['clubPointsMultiplier', 'Multiplicador de pontos do clube', '×'],
  ['freeShippingMinCents', 'Frete grátis do clube a partir de', 'R$', 'money'],
  ['shippingCents', 'Valor da entrega', 'R$', 'money'],
  ['centsPerPoint', 'Valor em compras para 1 ponto', 'R$', 'money'],
  ['pointsDiscountBlock', 'Pontos para desconto no pedido', 'pontos'],
  ['pointsDiscountCents', 'Valor desse desconto', 'R$', 'money'],
  ['pointsValidityDays', 'Validade dos pontos', 'dias'],
  ['referralPoints', 'Pontos por indicação (após 1ª compra)', 'pontos'],
  ['recoveryDays', 'Cliente vira "recuperação" após', 'dias sem compra'],
  ['careLeadDays', 'Lembrar cuidados com antecedência de', 'dias'],
];

export async function settings({ refresh }) {
  const { settings: s } = await call('GET', '/settings');
  return {
    title: 'Configurações',
    body: html`<section class="adm-card" style="max-width:720px"><form class="adm-form" novalidate>
      <p class="small muted">Regras do Clube Pet, dos pontos e dos lembretes. As mudanças valem para os próximos pedidos.</p>
      ${SETTINGS.map(([k, label, unit, type]) => field(k, `${label} (${unit})`, control({ name: k, inputmode: 'decimal', value: type === 'money' ? (s[k] / 100).toFixed(2).replace('.', ',') : s[k] })))}
      <button class="btn" type="submit">Salvar configurações</button></form></section>`,
    mount(main) {
      const form = main.querySelector('form');
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const body = Object.fromEntries(SETTINGS.map(([k, , , type]) => [k, type === 'money' ? money(form[k].value) : Number(String(form[k].value).replace(',', '.'))]));
        busy(form.querySelector('[type=submit]'), async () => {
          try { await call('PUT', '/settings', body); toast('Configurações salvas.'); refresh(); } catch (err) { showError(form, err); }
        });
      });
    },
  };
}
