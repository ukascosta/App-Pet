import { api, setToken } from '../api.js';
import { facebookLogo, googleLogo, icon } from '../icons.js';
import { html, maskPhone, passwordStrength, raw } from '../util.js';
import { busy, clearErrors, confirmSheet, control, eyeToggle, field, showError, toast, wirePasswordToggle } from '../ui.js';

export async function view({ app, navigate }) {
  const { customer, pets } = app.me;
  const storeLink = app.config.store.whatsapp ? `https://wa.me/${app.config.store.whatsapp}` : null;
  const providers = customer.providers.map((p) => (p === 'google' ? googleLogo(18) : facebookLogo(18))).join('');

  return {
    tab: 'account',
    body: html`
      <header class="pagehead"><h1>Conta</h1></header>
      <div class="stack-lg">
        ${customer.profileComplete ? '' : html`<div class="notice notice--warn" role="alert">${raw(icon('warn', 18))}<span>Seu cadastro está incompleto. <a href="#/completar">Informe o WhatsApp</a> para cadastrar seus pets.</span></div>`}
        <section class="card row" style="gap:16px">
          <div class="avatar-init" aria-hidden="true">${customer.name[0].toUpperCase()}</div>
          <div class="grow">
            <h2 style="font-size:1.25rem">${customer.name}</h2>
            <div class="muted small" style="overflow-wrap:anywhere">${customer.email}</div>
            <div class="small" style="margin-top:6px;display:flex;gap:8px;align-items:center"><span class="badge">${pets.length} ${pets.length === 1 ? 'pet' : 'pets'}</span>${raw(providers)}</div>
          </div>
        </section>

        <form class="card stack" data-profile novalidate>
          <h2>Seus dados</h2>
          ${field('name', 'Nome', control({ name: 'name', icon: 'user', value: customer.name, maxlength: 80, autocomplete: 'name' }))}
          ${field('whatsapp', 'WhatsApp', control({ name: 'whatsapp', type: 'tel', icon: 'chat', value: maskPhone(customer.whatsapp ?? ''), inputmode: 'tel' }), 'É por este número que a loja fala com você.')}
          <button class="btn btn--dark btn--block" type="submit">Salvar dados</button>
        </form>

        <details class="card">
          <summary style="padding:0">${raw(icon('next', 18))}<span class="grow" style="font-family:var(--font-display);font-size:1.3rem;font-weight:600;color:var(--ink)">${customer.hasPassword ? 'Alterar senha' : 'Criar uma senha'}</span></summary>
          <form class="stack" data-password novalidate style="margin-top:14px">
            ${customer.hasPassword ? field('currentPassword', 'Senha atual', control({ name: 'currentPassword', type: 'password', icon: 'key', autocomplete: 'current-password', action: eyeToggle() })) : ''}
            <div>
              ${field('newPassword', 'Nova senha', control({ name: 'newPassword', type: 'password', icon: 'lock', placeholder: 'Mínimo de 8 caracteres', autocomplete: 'new-password', action: eyeToggle() }))}
              <div class="strength" data-level="0" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
            </div>
            <button class="btn btn--block" type="submit">Salvar senha</button>
          </form>
        </details>

        <section class="card">
          <div class="menu">
            <a class="menu__row" href="#/avisos"><span class="badge-ic badge-ic--dark">${raw(icon('bell', 20))}</span><div class="grow">Avisos no celular<small>Ative ou desative na aba Avisos</small></div>${raw(icon('next', 18))}</a>
            ${storeLink
              ? html`<a class="menu__row" href="${storeLink}" target="_blank" rel="noopener"><span class="badge-ic badge-ic--mint">${raw(icon('store', 20))}</span><div class="grow">${app.config.store.name}<small>Falar com a loja no WhatsApp</small></div>${raw(icon('next', 18))}</a>`
              : html`<div class="menu__row"><span class="badge-ic badge-ic--mint">${raw(icon('store', 20))}</span><div class="grow">${app.config.store.name}<small>Sua loja recebe um aviso quando a ração estiver acabando</small></div></div>`}
          </div>
        </section>

        <div class="stack">
          <button class="btn btn--line btn--block" data-logout>${raw(icon('logout', 20))}Sair deste aparelho</button>
          <button class="btn btn--ghost btn--block" data-delete>${raw(icon('trash', 19))}Apagar meu cadastro e meus dados</button>
        </div>
      </div>`,
    mount(root) {
      wirePasswordToggle(root);

      const profile = root.querySelector('[data-profile]');
      profile.whatsapp.addEventListener('input', () => (profile.whatsapp.value = maskPhone(profile.whatsapp.value)));
      profile.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearErrors(profile);
        await busy(profile.querySelector('[type=submit]'), async () => {
          try {
            // O aceite de contato da loja só é dado na tela de cadastro; aqui nunca é concedido por tabela.
            await api.updateMe({ name: profile.name.value, whatsapp: profile.whatsapp.value });
            toast('Dados atualizados.');
          } catch (err) {
            showError(profile, err);
          }
        });
      });

      const pass = root.querySelector('[data-password]');
      const meter = pass.querySelector('.strength');
      pass.newPassword.addEventListener('input', () => (meter.dataset.level = String(passwordStrength(pass.newPassword.value))));
      pass.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearErrors(pass);
        await busy(pass.querySelector('[type=submit]'), async () => {
          try {
            await api.changePassword({ currentPassword: pass.currentPassword?.value, newPassword: pass.newPassword.value });
            toast('Senha alterada. Outros aparelhos foram desconectados.');
            pass.reset();
            meter.dataset.level = '0';
            app.me.customer.hasPassword = true;
          } catch (err) {
            showError(pass, err);
          }
        });
      });

      root.querySelector('[data-logout]').onclick = async () => {
        await api.logout().catch(() => {});
        setToken(null);
        navigate('#/entrar');
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
