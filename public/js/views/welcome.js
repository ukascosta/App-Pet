import { api, setToken } from '../api.js';
import { html } from '../util.js';
import { busy, clearErrors, field, showError } from '../ui.js';
import { maskPhone } from '../util.js';

export async function landing({ app }) {
  return {
    body: html`<section class="hero">
      <div class="art" aria-hidden="true">🐶</div>
      <h1>Nunca mais deixe a ração do seu pet acabar</h1>
      <p class="muted" style="margin-top:10px">Cadastre seu cão ou gato, veja quanto ele deve comer e saiba com antecedência quando precisa repor.</p>
      <ul class="points">
        <li><span>🥣</span><div><b>Quantidade certa para a raça</b><br /><span class="muted small">Sugestão de porção diária baseada em diretrizes de nutrição veterinária.</span></div></li>
        <li><span>⏳</span><div><b>Contagem regressiva automática</b><br /><span class="muted small">O app desconta a ração todo dia. Você só confere.</span></div></li>
        <li><span>💬</span><div><b>Aviso para você e para a loja</b><br /><span class="muted small">Quando estiver acabando, a loja fala com você pelo WhatsApp.</span></div></li>
      </ul>
      <a class="btn block" href="#/cadastro">Começar agora</a>
      <p style="margin-top:14px"><a class="link" href="#/entrar">Já tenho cadastro</a></p>
    </section>`,
  };
}

export async function register({ app, navigate }) {
  return {
    body: html`
      <div class="topbar"><a class="back" href="#/" aria-label="Voltar">‹</a><h1>Seus dados</h1></div>
      <form class="stack" novalidate>
        ${field('name', 'Seu nome', html`<input class="input" name="name" autocomplete="name" required maxlength="80" />`)}
        ${field('email', 'E-mail', html`<input class="input" name="email" type="email" inputmode="email" autocomplete="email" required />`)}
        ${field('whatsapp', 'WhatsApp', html`<input class="input" name="whatsapp" type="tel" inputmode="tel" autocomplete="tel" placeholder="(11) 99999-8888" required />`, 'Use um número com WhatsApp ativo: é por ele que você será avisado.')}
        <label class="check">
          <input type="checkbox" name="consent" />
          <span class="small">Autorizo a loja <b>${app.config.store.name}</b> a falar comigo pelo WhatsApp para oferecer ração quando a do meu pet estiver acabando. Posso apagar meu cadastro quando quiser.</span>
        </label>
        <span class="error" data-error-for="consent" role="alert"></span>
        <button class="btn block" type="submit">Continuar</button>
      </form>`,
    mount(root) {
      const form = root.querySelector('form');
      form.whatsapp.addEventListener('input', () => (form.whatsapp.value = maskPhone(form.whatsapp.value)));
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearErrors(form);
        await busy(form.querySelector('[type=submit]'), async () => {
          try {
            const res = await api.register({
              name: form.name.value,
              email: form.email.value,
              whatsapp: form.whatsapp.value,
              consent: form.consent.checked,
            });
            setToken(res.token);
            navigate('#/novo-pet');
          } catch (err) {
            showError(form, err);
          }
        });
      });
    },
  };
}

export async function login({ navigate }) {
  return {
    body: html`
      <div class="topbar"><a class="back" href="#/" aria-label="Voltar">‹</a><h1>Entrar</h1></div>
      <form class="stack" novalidate>
        <p class="muted">Use o mesmo e-mail e WhatsApp do seu cadastro.</p>
        ${field('email', 'E-mail', html`<input class="input" name="email" type="email" inputmode="email" autocomplete="email" required />`)}
        ${field('whatsapp', 'WhatsApp', html`<input class="input" name="whatsapp" type="tel" inputmode="tel" autocomplete="tel" placeholder="(11) 99999-8888" required />`)}
        <button class="btn block" type="submit">Entrar</button>
        <p class="center small muted">Ainda não tem cadastro? <a href="#/cadastro">Criar agora</a></p>
      </form>`,
    mount(root) {
      const form = root.querySelector('form');
      form.whatsapp.addEventListener('input', () => (form.whatsapp.value = maskPhone(form.whatsapp.value)));
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearErrors(form);
        await busy(form.querySelector('[type=submit]'), async () => {
          try {
            const res = await api.login({ email: form.email.value, whatsapp: form.whatsapp.value });
            setToken(res.token);
            navigate('#/');
          } catch (err) {
            showError(form, err.field ? err : Object.assign(err, { field: 'whatsapp' }));
          }
        });
      });
    },
  };
}
