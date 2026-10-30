// Ícones de traço arredondado (24x24), no mesmo espírito das letras do logo.

const PATHS = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5a1 1 0 0 0 1 1H10v-5.5h4v5.5h3.5a1 1 0 0 0 1-1V10"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  minus: '<path d="M5 12h14"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  next: '<path d="m9 18 6-6-6-6"/>',
  arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M9.9 9.9a3 3 0 1 0 4.2 4.2"/><path d="M10.7 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.2 3.1"/><path d="M6.6 6.6A16 16 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="m2 2 20 20"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="3"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="3"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  chat: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/><path d="M9 11h6"/><path d="M9 14.5h3.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  pencil: '<path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  store: '<path d="M3 9.5 4.6 4h14.8L21 9.5"/><path d="M3 9.5a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M5 12.5V20h14v-7.5"/><path d="M10 20v-4.5h4V20"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
  bag: '<path d="M6 2 3 6v13a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  scale: '<path d="M5 20h14a2 2 0 0 0 1.9-2.6L18.5 9h-13L3.1 17.4A2 2 0 0 0 5 20Z"/><path d="M9 9a3 3 0 0 1 6 0"/>',
  bowl: '<path d="M3 11h18a9 9 0 0 1-18 0Z"/><path d="M8 7.5c0-1.2 1-1.2 1-2.4"/><path d="M12 7.5c0-1.2 1-1.2 1-2.4"/><path d="M16 7.5c0-1.2 1-1.2 1-2.4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  warn: '<path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.7 9a1 1 0 0 1-.7 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.5 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  sparkle: '<path d="M12 3c.5 4.5 2.5 6.5 7 7-4.5.5-6.5 2.5-7 7-.5-4.5-2.5-6.5-7-7 4.5-.5 6.5-2.5 7-7Z"/>',
  drop: '<path d="M12 3s6 6.2 6 11a6 6 0 0 1-12 0c0-4.8 6-11 6-11Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.9 4.9 1.4 1.4"/><path d="m17.7 17.7 1.4 1.4"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m4.9 19.1 1.4-1.4"/><path d="m17.7 6.3 1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>',
  key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.8-9.8"/><path d="m16 7 3 3"/>',
  paw: '<ellipse cx="5.5" cy="11" rx="2" ry="2.8" fill="currentColor" stroke="none"/><ellipse cx="9.5" cy="6.5" rx="2" ry="2.8" fill="currentColor" stroke="none"/><ellipse cx="14.5" cy="6.5" rx="2" ry="2.8" fill="currentColor" stroke="none"/><ellipse cx="18.5" cy="11" rx="2" ry="2.8" fill="currentColor" stroke="none"/><path fill="currentColor" stroke="none" d="M12 11c-3 0-6 3.4-6 6.2 0 2 1.6 2.8 3.2 2.8 1.2 0 1.8-.5 2.8-.5s1.6.5 2.8.5c1.6 0 3.2-.8 3.2-2.8C18 14.4 15 11 12 11z"/>',
};

/** Ícone de traço. Herda a cor do texto (currentColor). */
export function icon(name, size = 22, cls = '') {
  return `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${PATHS[name]}</svg>`;
}

// Logos dos provedores de login (cores oficiais, por isso não herdam currentColor).
export const googleLogo = (size = 22) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path fill="#EA4335" d="M12 5.04c1.62 0 3.07.56 4.21 1.65l3.15-3.15C17.45 1.74 14.97.5 12 .5 7.7.5 3.99 2.97 2.18 6.57l3.66 2.84C6.71 6.83 9.12 5.04 12 5.04z"/><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58l3.78 2.93c2.21-2.04 3.64-5.05 3.64-8.75z"/><path fill="#FBBC05" d="M5.84 14.09A7.2 7.2 0 0 1 5.46 12c0-.73.13-1.43.37-2.09L2.17 7.07A11.5 11.5 0 0 0 .5 12c0 1.85.45 3.6 1.24 5.13l3.67-2.84z"/><path fill="#34A853" d="M12 23.5c3.24 0 5.95-1.08 7.93-2.91l-3.78-2.93c-1.05.71-2.4 1.14-4.15 1.14-2.88 0-5.3-1.9-6.16-4.46l-3.7 2.87C3.99 21.03 7.7 23.5 12 23.5z"/></svg>`;

export const facebookLogo = (size = 22) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path fill="#1877F2" d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.5c-1.5 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z"/></svg>`;
