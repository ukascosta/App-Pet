import { html } from './util.js';

let toastTimer;
export function toast(message) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.textContent = message;
  document.body.append(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 3200);
}

/** Janelinha que sobe de baixo. `content` é um template `html`. */
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
  overlay.addEventListener('click', (e) => e.target === overlay && close());
  overlay.addEventListener('click', (e) => e.target.closest('[data-close]') && close());
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
        <button class="btn block ${danger ? 'danger' : ''}" data-yes>${confirmLabel}</button>
        <button class="btn ghost block" data-close>Cancelar</button>
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
  input?.classList.add('invalid');
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

export const field = (name, label, control, hint) =>
  html`<label class="field">
    <span class="label">${label}</span>
    ${control}
    ${hint ? html`<span class="hint">${hint}</span>` : ''}
    <span class="error" data-error-for="${name}" role="alert"></span>
  </label>`;
