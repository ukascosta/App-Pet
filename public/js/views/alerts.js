import { api } from '../api.js';
import { html, fmtWhen } from '../util.js';
import { disablePush, enablePush, pushStatus } from '../push.js';
import { toast } from '../ui.js';

const PUSH_COPY = {
  available: ['Receber avisos no celular', 'Ative para saber na hora quando a ração estiver acabando.', 'Ativar avisos'],
  enabled: ['Avisos no celular ativados', 'Você será avisado mesmo com o app fechado.', 'Desativar'],
  denied: ['Avisos bloqueados', 'Libere as notificações nas configurações do navegador para recebê-los.', null],
  unsupported: ['Avisos no celular indisponíveis', 'No iPhone, toque em Compartilhar › Adicionar à Tela de Início e abra o app por lá.', null],
};

export async function view({ app }) {
  const [{ alerts }, status] = await Promise.all([api.alerts(), pushStatus()]);
  const [title, text, action] = PUSH_COPY[status];
  const unread = alerts.filter((a) => !a.read).length;

  return {
    tab: 'alerts',
    body: html`
      <header style="margin-bottom:18px"><h1>Avisos</h1></header>
      <div class="stack">
        <section class="card stack">
          <div class="row"><div class="avatar" aria-hidden="true">🔔</div><div class="grow"><h3>${title}</h3><p class="small muted">${text}</p></div></div>
          ${action ? html`<button class="btn small ${status === 'enabled' ? 'secondary' : ''}" data-push="${status}">${action}</button>` : ''}
        </section>
        ${alerts.length
          ? alerts.map(
              (a) => html`<a class="card tap alert-item ${a.read ? '' : 'unread'}" href="#/pet/${a.petId ?? ''}" style="text-decoration:none">
                <div class="avatar ${a.kind === 'empty' ? '' : 'cat'}" aria-hidden="true">${a.kind === 'empty' ? '🚨' : '🥣'}</div>
                <div class="grow"><b>${a.title}</b><p class="small muted">${a.body}</p><p class="small muted">${fmtWhen(a.createdAt)}</p></div>
              </a>`,
            )
          : html`<p class="center muted" style="padding:30px 10px">Nenhum aviso por enquanto. Quando a ração de algum pet estiver acabando, você vê aqui.</p>`}
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
          location.reload();
        } catch (err) {
          toast(err.message || 'Não foi possível ativar os avisos.');
        }
      });
      // Ao abrir a tela, tudo é considerado lido (o contador some ao navegar).
      if (unread) {
        await api.readAlerts().catch(() => {});
        root.querySelector('.tab .dot')?.remove();
        app.me.unreadAlerts = 0;
      }
    },
  };
}
