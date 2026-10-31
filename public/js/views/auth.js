import { api, setToken } from '../api.js';
import { logoHorizontalSvg, markSvg } from '../brand.js';
import { facebookLogo, googleLogo, icon } from '../icons.js';
import { html, maskPhone, passwordStrength, raw } from '../util.js';
import { busy, clearErrors, control, eyeToggle, field, showError, toast, wirePasswordToggle } from '../ui.js';
import { markOnboarded } from './onboarding.js';

const SOCIAL_ERRORS = {
  cancelado: 'Você cancelou o login. Tente de novo quando quiser.',
  sessao_expirada: 'O login expirou. Tente novamente.',
  falha: 'Não foi possível entrar agora. Tente de novo ou use e-mail e senha.',
  sem_email: 'Não recebemos o seu e-mail desse login. Crie a conta com e-mail e senha.',
  email_em_uso: 'Este e-mail já tem cadastro. Entre com a senha (ou toque em "Esqueci a senha").',
  indisponivel_google: 'O login com o Google ainda não foi ativado neste servidor.',
  indisponivel_facebook: 'O login com o Facebook ainda não foi ativado neste servidor.',
};

/** Casca das telas de entrada: faixa laranja com o logo e cartão branco por cima. */
function shell({ title, text, back, compact = false, peek = true, card, foot = '' }) {
  return html`<header class="auth-hero ${compact ? 'auth-hero--compact' : ''}">
      ${back ? html`<a class="iconbtn back" href="${back}" aria-label="Voltar">${raw(icon('back', 22))}</a>` : ''}
      <span class="logo">${raw(logoHorizontalSvg())}</span>
      <h1>${title}</h1>
      <p>${text}</p>
      ${peek ? html`<div class="peek">${raw(markSvg())}</div>` : ''}
    </header>
    <div class="auth-card">${card}</div>
    <p class="auth-foot">${foot}</p>`;
}

/** Botões "Google" e "Facebook" (aparecem se configurados; fora de produção aparecem sempre, para ver o layout). */
function socialButtons(app, verb) {
  const { google, facebook, preview } = app.config.auth;
  if (!(google || facebook || preview)) return '';
  return html`<div class="divider"><span>ou ${verb} com</span></div>
    <div class="social">
      <button type="button" data-social="google">${raw(googleLogo(22))}Google</button>
      <button type="button" data-social="facebook">${raw(facebookLogo(22))}Facebook</button>
    </div>`;
}

function wireSocial(root) {
  root.querySelectorAll('[data-social]').forEach((b) =>
    b.addEventListener('click', () => {
      markOnboarded();
      location.href = `/auth/${b.dataset.social}`;
    }),
  );
}

const phoneInput = (form) => form.whatsapp.addEventListener('input', () => (form.whatsapp.value = maskPhone(form.whatsapp.value)));

// ---------- entrar ----------

export async function login({ app, query, navigate }) {
  const erro = SOCIAL_ERRORS[query.get('erro')];
  return {
    bare: true,
    body: shell({
      title: 'Que bom te ver!',
      text: 'Entre para acompanhar a ração do seu pet.',
      card: html`${erro ? html`<div class="notice notice--warn" role="alert" style="margin-bottom:16px">${raw(icon('warn', 18))}<span>${erro}</span></div>` : ''}
        <form class="stack" novalidate>
          ${field('email', 'E-mail', control({ name: 'email', type: 'email', icon: 'mail', placeholder: 'voce@email.com', autocomplete: 'email', inputmode: 'email' }))}
          ${field('password', 'Senha', control({ name: 'password', type: 'password', icon: 'lock', placeholder: 'Sua senha', autocomplete: 'current-password', action: eyeToggle() }))}
          <div style="text-align:right"><a class="link" href="#/senha/esqueci">Esqueci a senha</a></div>
          <button class="btn btn--block" type="submit">Entrar</button>
          ${socialButtons(app, 'entre')}
        </form>`,
      foot: html`Ainda não tem conta? <a href="#/cadastro">Criar conta</a>`,
    }),
    mount(root) {
      wirePasswordToggle(root);
      wireSocial(root);
      const form = root.querySelector('form');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearErrors(form);
        await busy(form.querySelector('[type=submit]'), async () => {
          try {
            const res = await api.login({ email: form.email.value, password: form.password.value });
            setToken(res.token);
            navigate('#/');
          } catch (err) {
            showError(form, err);
          }
        });
      });
    },
  };
}

// ---------- criar conta ----------

export async function register({ app, navigate }) {
  return {
    bare: true,
    body: shell({
      title: 'Criar conta',
      text: 'Leva menos de 1 minuto.',
      back: '#/entrar',
      compact: true,
      card: html`<form class="stack" novalidate>
          ${field('name', 'Seu nome', control({ name: 'name', icon: 'user', placeholder: 'Como você se chama?', autocomplete: 'name', maxlength: 80 }))}
          ${field('email', 'E-mail', control({ name: 'email', type: 'email', icon: 'mail', placeholder: 'voce@email.com', autocomplete: 'email', inputmode: 'email' }))}
          ${field('whatsapp', 'WhatsApp', control({ name: 'whatsapp', type: 'tel', icon: 'chat', placeholder: '(11) 99999-8888', autocomplete: 'tel', inputmode: 'tel' }), 'Use um número com WhatsApp ativo: é por ele que a loja fala com você.')}
          <div>
            ${field('password', 'Senha', control({ name: 'password', type: 'password', icon: 'lock', placeholder: 'Mínimo de 8 caracteres', autocomplete: 'new-password', action: eyeToggle() }))}
            <div class="strength" data-level="0" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
          </div>
          <details><summary>${raw(icon('users', 18))}Tenho um código de indicação</summary>
            ${field('referralCode', 'Código de quem indicou', control({ name: 'referralCode', placeholder: 'Ex.: PET4XQ', autocomplete: 'off' }))}</details>
          <label class="check">
            <input type="checkbox" name="consent" />
            <span class="small">Autorizo a loja <b>${app.config.store.name}</b> a falar comigo pelo WhatsApp para oferecer ração quando a do meu pet estiver acabando. Posso apagar meu cadastro quando quiser.</span>
          </label>
          <span class="field__error" data-error-for="consent" role="alert"></span>
          <button class="btn btn--block" type="submit">Criar conta</button>
          ${socialButtons(app, 'cadastre-se')}
        </form>`,
      foot: html`Já tem conta? <a href="#/entrar">Entrar</a>`,
    }),
    mount(root) {
      wirePasswordToggle(root);
      wireSocial(root);
      const form = root.querySelector('form');
      phoneInput(form);
      const meter = root.querySelector('.strength');
      form.password.addEventListener('input', () => (meter.dataset.level = String(passwordStrength(form.password.value))));
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearErrors(form);
        await busy(form.querySelector('[type=submit]'), async () => {
          try {
            const res = await api.register({
              name: form.name.value,
              email: form.email.value,
              whatsapp: form.whatsapp.value,
              password: form.password.value,
              consent: form.consent.checked,
              referralCode: form.referralCode.value.trim() || undefined,
            });
            setToken(res.token);
            markOnboarded();
            navigate('#/novo-pet');
          } catch (err) {
            showError(form, err);
          }
        });
      });
    },
  };
}

// ---------- esqueci a senha ----------

export async function forgot() {
  return {
    bare: true,
    body: shell({
      title: 'Esqueceu a senha?',
      text: 'Sem problema: enviamos um link para criar outra.',
      back: '#/entrar',
      compact: true,
      card: html`<form class="stack" novalidate>
          ${field('email', 'E-mail do cadastro', control({ name: 'email', type: 'email', icon: 'mail', placeholder: 'voce@email.com', autocomplete: 'email', inputmode: 'email' }))}
          <button class="btn btn--block" type="submit">Enviar link</button>
        </form>
        <div class="stack" data-sent hidden>
          <div class="notice" role="status">${raw(icon('check', 18))}<span>Se esse e-mail tiver cadastro, o link já está a caminho. Confira também a caixa de spam. Ele vale por 1 hora.</span></div>
          <a class="btn btn--dark btn--block" href="#/entrar">Voltar para o login</a>
        </div>`,
      foot: html`Lembrou? <a href="#/entrar">Entrar</a>`,
    }),
    mount(root) {
      const form = root.querySelector('form');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearErrors(form);
        await busy(form.querySelector('[type=submit]'), async () => {
          try {
            await api.forgotPassword(form.email.value);
            form.hidden = true;
            root.querySelector('[data-sent]').hidden = false;
          } catch (err) {
            showError(form, err);
          }
        });
      });
    },
  };
}

// ---------- criar nova senha (link do e-mail) ----------

export async function reset({ query, navigate }) {
  const token = query.get('token') ?? '';
  return {
    bare: true,
    body: shell({
      title: 'Nova senha',
      text: 'Escolha uma senha que você não use em outros lugares.',
      back: '#/entrar',
      compact: true,
      card: html`<form class="stack" novalidate>
          <div>
            ${field('password', 'Nova senha', control({ name: 'password', type: 'password', icon: 'lock', placeholder: 'Mínimo de 8 caracteres', autocomplete: 'new-password', action: eyeToggle() }))}
            <div class="strength" data-level="0" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
          </div>
          <span class="field__error" data-error-for="token" role="alert"></span>
          <button class="btn btn--block" type="submit">Salvar nova senha</button>
          <p class="center small"><a href="#/senha/esqueci">Pedir um novo link</a></p>
        </form>`,
    }),
    mount(root) {
      wirePasswordToggle(root);
      const form = root.querySelector('form');
      const meter = root.querySelector('.strength');
      form.password.addEventListener('input', () => (meter.dataset.level = String(passwordStrength(form.password.value))));
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearErrors(form);
        await busy(form.querySelector('[type=submit]'), async () => {
          try {
            const res = await api.resetPassword(token, form.password.value);
            setToken(res.token);
            toast('Senha alterada. Você já está dentro!');
            navigate('#/');
          } catch (err) {
            showError(form, err);
          }
        });
      });
    },
  };
}

// ---------- retorno do login com Google/Facebook ----------

export async function oauthReturn({ query, navigate }) {
  try {
    const res = await api.oauthExchange(query.get('code') ?? '');
    setToken(res.token);
    markOnboarded();
    navigate(res.customer.profileComplete ? '#/' : '#/completar');
  } catch (err) {
    toast(err.message);
    navigate('#/entrar?erro=sessao_expirada');
  }
  return { body: '<div class="spinner" role="status" aria-label="Entrando"></div>' };
}

// ---------- completar cadastro (quem entrou com Google/Facebook) ----------

export async function complete({ app, navigate }) {
  const { customer } = app.me;
  if (customer.profileComplete) {
    navigate('#/');
    return { body: '' };
  }
  return {
    bare: true,
    body: shell({
      title: `Quase lá, ${customer.name.split(' ')[0]}!`,
      text: 'Falta só o seu WhatsApp para a loja poder avisar você.',
      card: html`<form class="stack" novalidate>
          ${field('name', 'Seu nome', control({ name: 'name', icon: 'user', value: customer.name, autocomplete: 'name', maxlength: 80 }))}
          ${field('whatsapp', 'WhatsApp', control({ name: 'whatsapp', type: 'tel', icon: 'chat', placeholder: '(11) 99999-8888', autocomplete: 'tel', inputmode: 'tel' }), 'Use um número com WhatsApp ativo.')}
          <label class="check">
            <input type="checkbox" name="consent" />
            <span class="small">Autorizo a loja <b>${app.config.store.name}</b> a falar comigo pelo WhatsApp para oferecer ração quando a do meu pet estiver acabando.</span>
          </label>
          <span class="field__error" data-error-for="consent" role="alert"></span>
          <button class="btn btn--block" type="submit">Continuar</button>
        </form>`,
    }),
    mount(root) {
      const form = root.querySelector('form');
      phoneInput(form);
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearErrors(form);
        await busy(form.querySelector('[type=submit]'), async () => {
          try {
            await api.updateMe({ name: form.name.value, whatsapp: form.whatsapp.value, consent: form.consent.checked });
            navigate('#/novo-pet');
          } catch (err) {
            showError(form, err);
          }
        });
      });
    },
  };
}
