/**
 * Design system Vagari — tokens compartilhados entre o app (React Native) e o painel (web).
 *
 * Roxo predominante, app claro, laranja em pontos de destaque.
 * ⚠️ Cores provisórias: o Behance com a identidade não abriu neste ambiente.
 * Quando chegarem os códigos oficiais, troque só aqui.
 */
export const colors = {
  // Roxo Vagari (marca)
  purple50: '#F5F1FF',
  purple100: '#EBE3FF',
  purple200: '#D6C6FF',
  purple300: '#B89CFF',
  purple400: '#9570F7',
  purple500: '#7347EC',
  purple600: '#5B2BD9', // cor principal: botões, títulos de destaque, aba ativa
  purple700: '#4820B3',
  purple800: '#35188A',
  purple900: '#22104F',

  // Laranja (acento — usar com moderação)
  orange50: '#FFF3EA',
  orange100: '#FFE2CC',
  orange300: '#FFB37A',
  orange500: '#FF7A1A', // acento: contagem regressiva, indicação Vagari, ícones duotone
  orange600: '#E9620A',

  // Neutros (levemente arroxeados para conversar com a marca)
  ink: '#1D1636', // texto principal
  inkSoft: '#4A4466',
  muted: '#7A7494',
  line: '#ECE8F5',
  lineStrong: '#D9D3EA',
  bg: '#F8F6FD', // fundo do app (claro)
  surface: '#FFFFFF',
  surfaceAlt: '#F2EFFA',

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
  overlay: 'rgba(29, 22, 54, 0.55)',
  whatsapp: '#25D366',
};

/**
 * Tipografia.
 * - Títulos H1: Neulis (fonte oficial). Enquanto os arquivos licenciados não chegam,
 *   usamos Outfit (geométrica, mesma família visual) no lugar.
 * - Demais textos: Plus Jakarta Sans — legível em telas pequenas, com personalidade.
 */
export const fonts = {
  display: 'Outfit_700Bold',
  displaySemi: 'Outfit_600SemiBold',
  body: 'PlusJakartaSans_400Regular',
  bodyMedium: 'PlusJakartaSans_500Medium',
  bodySemi: 'PlusJakartaSans_600SemiBold',
  bodyBold: 'PlusJakartaSans_700Bold',
  bodyExtra: 'PlusJakartaSans_800ExtraBold',
};

export const webFonts = {
  display: "'Neulis', 'Outfit', system-ui, sans-serif",
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
  card: { shadowColor: '#3A1F8C', shadowOpacity: 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
  float: { shadowColor: '#3A1F8C', shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
};

/** Gradientes usados nas capas enquanto as fotos reais não chegam (e por cima das fotos). */
export const gradients = {
  brand: ['#7347EC', '#4820B3'],
  dusk: ['#5B2BD9', '#FF7A1A'],
  photoFade: ['rgba(34,16,79,0)', 'rgba(34,16,79,0.78)'],
};
