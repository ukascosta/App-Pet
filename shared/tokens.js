/**
 * Design system Vagari — tokens compartilhados entre o app (React Native) e o painel (web).
 *
 * Paleta oficial Vagari: roxo principal #4B134B, roxo vibrante #6D1660, roxo vinho #54073D,
 * roxo mais escuro #3C0328, laranja #F77A10, off-white #F7F2EE e branco.
 * Roxo predominante, app claro, laranja em pontos de destaque. Troque as cores só aqui.
 */
export const colors = {
  // Roxo Vagari (marca)
  purple50: '#F6ECF4',
  purple100: '#EBD6E6',
  purple200: '#D6AECD',
  purple300: '#B97DAE',
  purple400: '#944488',
  purple500: '#6D1660', // roxo vibrante
  purple600: '#4B134B', // cor principal: botões, títulos de destaque, aba ativa
  purple700: '#54073D', // roxo vinho
  purple800: '#3C0328', // roxo mais escuro
  purple900: '#2A0220',

  // Laranja (acento — usar com moderação)
  orange50: '#FFF1E4',
  orange100: '#FFE0C7',
  orange300: '#FBAE6E',
  orange500: '#F77A10', // laranja principal — acento: contagem regressiva, indicação Vagari, ícones duotone
  orange600: '#D45F0A',

  // Neutros (levemente arroxeados para conversar com a marca)
  ink: '#2A1027', // texto principal
  inkSoft: '#5B4558',
  muted: '#7A6475',
  line: '#E9DFDA',
  lineStrong: '#D8CBC5',
  bg: '#F7F2EE', // fundo do app (claro)
  surface: '#FFFFFF',
  surfaceAlt: '#F0E8E3',

  // Estados
  success: '#14A06B',
  successBg: '#E5F7EF',
  warning: '#D98A00',
  warningBg: '#FFF5DD',
  danger: '#D9354F',
  dangerBg: '#FDE8EC',
  info: '#2D6BE0',
  infoBg: '#E7EFFD',

  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(42, 16, 39, 0.55)',
  whatsapp: '#25D366',
};

/**
 * Tipografia.
 * - H1 e números grandes: Neulis (fonte oficial, com letras decorativas — arquivos em brand/fonts).
 * - H2/H3: NeulisAlt (mesma família, letras mais limpas para leitura rápida).
 * - Demais textos: Plus Jakarta Sans — legível em telas pequenas, com personalidade.
 */
export const fonts = {
  display: 'Neulis_Bold',
  displaySemi: 'Neulis_SemiBold',
  displayAlt: 'NeulisAlt_Bold',
  displayAltSemi: 'NeulisAlt_SemiBold',
  body: 'PlusJakartaSans_400Regular',
  bodyMedium: 'PlusJakartaSans_500Medium',
  bodySemi: 'PlusJakartaSans_600SemiBold',
  bodyBold: 'PlusJakartaSans_700Bold',
  bodyExtra: 'PlusJakartaSans_800ExtraBold',
};

export const webFonts = {
  display: "'Neulis', system-ui, sans-serif",
  displayAlt: "'Neulis Alt', 'Neulis', system-ui, sans-serif",
  body: "'Plus Jakarta Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
};

export const type = {
  h1: { fontSize: 32, lineHeight: 36, letterSpacing: -0.6 },
  h2: { fontSize: 24, lineHeight: 30, letterSpacing: -0.3 },
  h3: { fontSize: 19, lineHeight: 24, letterSpacing: -0.2 },
  body: { fontSize: 15, lineHeight: 22 },
  bodySm: { fontSize: 13, lineHeight: 18 },
  caption: { fontSize: 11, lineHeight: 14, letterSpacing: 0.4 },
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 };
export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };

export const shadow = {
  card: { shadowColor: '#4B134B', shadowOpacity: 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
  float: { shadowColor: '#4B134B', shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
};

/** Gradientes usados nas capas enquanto as fotos reais não chegam (e por cima das fotos). */
export const gradients = {
  brand: ['#6D1660', '#54073D'],
  dusk: ['#4B134B', '#F77A10'],
  photoFade: ['rgba(42, 2, 32,0)', 'rgba(42, 2, 32,0.78)'],
};
