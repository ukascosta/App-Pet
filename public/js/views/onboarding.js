import { logoHorizontalSvg } from '../brand.js';
import { artCountdown, artPortion, artStore } from '../art.js';
import { html, raw } from '../util.js';

const SLIDES = [
  { art: artPortion, title: 'A porção certa para a raça', text: 'Veja quanto o seu cão ou gato deve comer por dia e em quais horários, com base em diretrizes de nutrição veterinária.' },
  { art: artCountdown, title: 'Contagem regressiva automática', text: 'O app desconta a ração todos os dias. Você sempre sabe quantos dias ainda faltam.' },
  { art: artStore, title: 'Avisamos você e a loja', text: 'Quando a ração estiver acabando, você recebe o aviso e a loja entra em contato pelo WhatsApp.' },
];

export function markOnboarded() {
  try {
    localStorage.setItem('petlee.onboarded', '1');
  } catch {
    /* ignora */
  }
}

export const wasOnboarded = () => {
  try {
    return localStorage.getItem('petlee.onboarded') === '1';
  } catch {
    return false;
  }
};

export async function landing({ navigate }) {
  // Quem já viu as boas-vindas vai direto para o login.
  if (wasOnboarded()) {
    navigate('#/entrar');
    return { body: '' };
  }
  return {
    bare: true,
    body: html`<section class="onb">
      <div class="onb__top">
        <span class="logo">${raw(logoHorizontalSvg())}</span>
        <a class="link" href="#/entrar" data-skip>Pular</a>
      </div>
      <div class="onb__slides" tabindex="0" aria-label="Apresentação do app">
        ${SLIDES.map((s) => html`<article class="onb__slide">${raw(s.art())}<h1>${s.title}</h1><p>${s.text}</p></article>`)}
      </div>
      <div class="dots" aria-hidden="true">${SLIDES.map((_, i) => html`<i class="${i === 0 ? 'on' : ''}"></i>`)}</div>
      <div class="onb__cta">
        <a class="btn btn--block" href="#/cadastro" data-start>Criar conta</a>
        <a class="btn btn--ghost btn--block" href="#/entrar" data-start>Já tenho conta</a>
      </div>
    </section>`,
    mount(root) {
      root.querySelectorAll('[data-start], [data-skip]').forEach((a) => a.addEventListener('click', markOnboarded));
      const slides = root.querySelector('.onb__slides');
      const dots = [...root.querySelectorAll('.dots i')];
      slides.addEventListener('scroll', () => {
        const i = Math.round(slides.scrollLeft / slides.clientWidth);
        dots.forEach((d, n) => d.classList.toggle('on', n === i));
      }, { passive: true });
    },
  };
}
