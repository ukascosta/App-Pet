import { api, setToken } from '../api.js';
import { html, maskPhone } from '../util.js';
import { busy, clearErrors, confirmSheet, field, showError, toast } from '../ui.js';

export async function view({ app, navigate }) {
  const { customer } = app.me;
  const storeLink = app.config.store.whatsapp ? `https://wa.me/${app.config.store.whatsapp}` : null;

  return {
    tab: 'account',
    body: html`
      <header style="margin-bottom:18px"><h1>Conta</h1></header>
      <div class="stack">
        <form class="card stack" novalidate>
          <h2>Seus dados</h2>
          ${field('name', 'Nome', html`<input class="input" name="name" value="${customer.name}" maxlength="80" autocomplete="name" />`)}
          <div class="field"><span class="label">E-mail</span><div class="muted">${customer.email}</div></div>
          ${field('whatsapp', 'WhatsApp', html`<input class="input" name="whatsapp" type="tel" inputmode="tel" value="${maskPhone(customer.whatsapp)}" />`, 'É por este número que a loja fala com você.')}
          <button class="btn" type="submit">Salvar</button>
        </form>

        <section class="card stack">
          <h2>${app.config.store.name}</h2>
          <p class="small muted">Sua loja recebe um aviso automático quando a ração de algum pet está acabando e entra em contato com você.</p>
          ${storeLink ? html`<a class="btn secondary" href="${storeLink}" target="_blank" rel="noopener">Falar com a loja no WhatsApp</a>` : ''}
        </section>

        <button class="btn secondary block" data-logout>Sair deste aparelho</button>
        <button class="btn ghost block" data-delete>Apagar meu cadastro e meus dados</button>
      </div>`,
    mount(root) {
      const form = root.querySelector('form');
      form.whatsapp.addEventListener('input', () => (form.whatsapp.value = maskPhone(form.whatsapp.value)));
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearErrors(form);
        await busy(form.querySelector('[type=submit]'), async () => {
          try {
            await api.updateMe({ name: form.name.value, whatsapp: form.whatsapp.value });
            toast('Dados atualizados.');
          } catch (err) {
            showError(form, err);
          }
        });
      });

      root.querySelector('[data-logout]').onclick = async () => {
        await api.logout().catch(() => {});
        setToken(null);
        navigate('#/');
      };

      root.querySelector('[data-delete]').onclick = async () => {
        const yes = await confirmSheet({
          title: 'Apagar tudo?',
          text: 'Seu cadastro, seus pets e os avisos serão apagados para sempre. A loja deixa de receber avisos sobre você.',
          confirmLabel: 'Apagar meus dados',
          danger: true,
        });
        if (!yes) return;
        try {
          await api.deleteMe();
          setToken(null);
          toast('Seus dados foram apagados.');
          navigate('#/');
        } catch (err) {
          toast(err.message);
        }
      };
    },
  };
}
