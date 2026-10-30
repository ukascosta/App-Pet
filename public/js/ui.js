import { icon } from './icons.js';
import { html, raw } from './util.js';

let toastTimer;
export function toast(message) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.textContent = message;
  document.body.append(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 3400);
}

/** Janelinha que sobe de baixo. `content` é uma string HTML (use `.toString()` de um template `html`). */
export function sheet(content, { onMount, onClose } = {}) {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${content}</div>`;
  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
    onClose?.();
  };
  const onKey = (e) => e.key === 'Escape' && close();
  overlay.addEventListener('click', (e) => (e.target === overlay || e.target.closest('[data-close]')) && close());
  document.addEventListener('keydown', onKey);
  document.body.append(overlay);
  overlay.querySelector('input, button:not([data-close])')?.focus();
  onMount?.(overlay, close);
  return { el: overlay, close };
}

/** Pergunta "tem certeza?" e devolve true/false. */
export function confirmSheet({ title, text, confirmLabel, danger = false }) {
  return new Promise((resolve) => {
    let answer = false;
    const { el, close } = sheet(
      html`<div class="stack">
        <h2>${title}</h2>
        <p class="muted">${text}</p>
        <button class="btn btn--block ${danger ? 'btn--danger' : 'btn--dark'}" data-yes>${confirmLabel}</button>
        <button class="btn btn--ghost btn--block" data-close>Cancelar</button>
      </div>`.toString(),
      { onClose: () => resolve(answer) },
    );
    el.querySelector('[data-yes]').addEventListener('click', () => {
      answer = true;
      close();
    });
  });
}

// ---------- formulários ----------

export function clearErrors(form) {
  form.querySelectorAll('[data-error-for]').forEach((e) => (e.textContent = ''));
  form.querySelectorAll('.invalid').forEach((e) => e.classList.remove('invalid'));
}

/** Mostra o erro do servidor embaixo do campo certo (ou num aviso, se não for de um campo). */
export function showError(form, err) {
  clearErrors(form);
  const slot = err.field && form.querySelector(`[data-error-for="${err.field}"]`);
  if (!slot) return toast(err.message);
  slot.textContent = err.message;
  const input = form.querySelector(`[name="${err.field}"]`);
  input?.closest('.control')?.classList.add('invalid');
  input?.focus();
  slot.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

/** Desativa o botão enquanto a ação roda (evita toque duplo). */
export async function busy(button, action) {
  button.disabled = true;
  try {
    return await action();
  } finally {
    button.disabled = false;
  }
}

/**
 * Campo de texto com ícone à esquerda, unidade à direita e botão de ação (ex.: mostrar senha).
 * @returns {import('./util.js').Safe}
 */
export function control({ name, type = 'text', value = '', placeholder = '', icon: ic, unit, action, ...attrs }) {
  const extra = Object.entries(attrs)
    .map(([k, v]) => (v === true ? k : `${k}="${String(v).replace(/"/g, '&quot;')}"`))
    .join(' ');
  return html`<div class="control">
    ${ic ? html`<span class="control__icon">${raw(icon(ic, 20))}</span>` : ''}
    <input class="control__input" id="f-${name}" name="${name}" type="${type}" value="${value}" placeholder="${placeholder}" ${raw(extra)} />
    ${unit ? html`<span class="control__unit">${unit}</span>` : ''}
    ${action ?? ''}
  </div>`;
}

export const field = (name, label, controlHtml, hint) =>
  html`<div class="field">
    <label class="field__label" for="f-${name}">${label}</label>
    ${controlHtml}
    ${hint ? html`<span class="field__hint">${hint}</span>` : ''}
    <span class="field__error" data-error-for="${name}" role="alert"></span>
  </div>`;

/** Botão de olho para mostrar/ocultar a senha. */
export const eyeToggle = () =>
  html`<button type="button" class="control__action" data-toggle-password aria-label="Mostrar senha">${raw(icon('eye', 20))}</button>`;

export function wirePasswordToggle(root) {
  root.querySelectorAll('[data-toggle-password]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = btn.closest('.control').querySelector('input');
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.innerHTML = icon(show ? 'eyeOff' : 'eye', 20);
      btn.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha');
    });
  });
}
