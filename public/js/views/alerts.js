import { api } from '../api.js';
import { artEmptyAlerts } from '../art.js';
import { icon } from '../icons.js';
import { disablePush, enablePush, pushStatus } from '../push.js';
import { fmtWhen, html, raw } from '../util.js';
import { toast } from '../ui.js';

const PUSH_COPY = {
  available: ['Receber avisos no celular', 'Ative para saber na hora quando a ração estiver acabando.', 'Ativar avisos'],
  enabled: ['Avisos no celular ativados', 'Você será avisado mesmo com o app fechado.', 'Desativar'],
  denied: ['Avisos bloqueados', 'Libere as notificações nas configurações do navegador para recebê-los.', null],
  unsupported: ['Avisos no celular indisponíveis', 'No iPhone, toque em Compartilhar › Adicionar à Tela de Início e abra o app por lá.', null],
};

export async function view({ app, refresh }) {
  const [{ alerts }, status] = await Promise.all([api.alerts(), pushStatus()]);
  const [title, text, action] = PUSH_COPY[status];
  const unread = alerts.filter((a) => !a.read).length;

  return {
    tab: 'account',
    body: html`
      <header class="pagehead"><h1>Avisos</h1></header>
      <div class="stack">
        <section class="card card--soft stack">
          <div class="row"><div class="menu__row" style="padding:0;flex:1"><span class="badge-ic badge-ic--dark">${raw(icon('bell', 22))}</span><div><b>${title}</b><small>${text}</small></div></div></div>
          ${action ? html`<button class="btn btn--sm ${status === 'enabled' ? 'btn--line' : 'btn--dark'}" data-push="${status}">${action}</button>` : ''}
        </section>
        ${alerts.length
          ? alerts.map(
              (a) => html`<a class="card alert-item ${a.read ? '' : 'unread'}" href="#/pet/${a.petId ?? ''}">
                <span class="ico ${a.kind === 'empty' ? 'ico--empty' : ''}">${raw(icon(a.kind === 'empty' ? 'warn' : 'bowl', 22))}</span>
                <div class="grow"><b>${a.title}</b><p class="small muted" style="margin-top:2px">${a.body}</p><p class="small muted" style="margin-top:6px;font-weight:700">${fmtWhen(a.createdAt)}</p></div>
              </a>`,
            )
          : html`<section class="empty">${raw(artEmptyAlerts())}<h2>Tudo tranquilo por aqui</h2><p>Quando a ração de algum pet estiver acabando, o aviso aparece aqui.</p></section>`}
      </div>`,
    async mount(root) {
      root.querySelector('[data-push]')?.addEventListener('click', async (e) => {
        try {
          if (e.currentTarget.dataset.push === 'enabled') {
            await disablePush();
            toast('Avisos no celular desativados.');
          } else if (await enablePush(app.config.vapidPublicKey)) {
            toast('Avisos ativados!');
          } else {
            toast('Permissão negada.');
          }
          refresh();
        } catch (err) {
          toast(err.message || 'Não foi possível ativar os avisos.');
        }
      });
      // Ao abrir a tela, tudo é considerado lido.
      if (unread) {
        await api.readAlerts().catch(() => {});
        root.querySelector('.tab .dot')?.remove();
        app.me.unreadAlerts = 0;
      }
    },
  };
}
