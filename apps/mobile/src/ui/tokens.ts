/* Design tokens of the app — the same values as the :root block in
   apps/web/src/ui/ui.css, so the app and the site look like one product.
   Change a colour here and in ui.css together. */

export const colors = {
  page: '#0d1c18',
  pageRaised: '#132620',
  surface: '#172d25',
  surfaceSoft: '#1d352b',
  ink: '#f1e8d3',
  inkSoft: '#c7bda8',
  inkFaint: '#9d9483',
  line: 'rgba(211, 177, 100, 0.27)',
  lineStrong: 'rgba(211, 177, 100, 0.55)',
  accent: '#d2a64d',
  accentStrong: '#ebc66f',
  accentInk: '#241a0c',
  accentBorder: '#e4bb62',
  accentWash: 'rgba(210, 166, 77, 0.12)',
  danger: '#f0a28e',
  success: '#9ecb9a',
  backdrop: 'rgba(4, 13, 10, 0.82)',
  ghost: 'rgba(20, 42, 34, 0.84)',
} as const

export const radius = {
  card: 18,
  control: 12,
  pill: 999,
} as const

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const

export const sizes = {
  control: 42,
  button: 48,
  header: 72,
  tabBar: 64,
} as const

/* Family names as expo-font registers them (one name per weight, since
   React Native cannot synthesise weights for custom fonts). Cormorant
   Garamond is the body face, Cinzel Decorative the display face, exactly
   as on the site. */
export const fonts = {
  body: 'CormorantGaramond_400Regular',
  bodyItalic: 'CormorantGaramond_400Regular_Italic',
  semibold: 'CormorantGaramond_600SemiBold',
  bold: 'CormorantGaramond_700Bold',
  display: 'CinzelDecorative_700Bold',
  displayBlack: 'CinzelDecorative_900Black',
} as const

/* Cormorant sets small, so the body runs a little larger than a system face. */
export const typeScale = {
  small: { fontSize: 15, lineHeight: 20 },
  body: { fontSize: 18, lineHeight: 26 },
  lead: { fontSize: 20, lineHeight: 28 },
  heading: { fontSize: 24, lineHeight: 30 },
  title: { fontSize: 22, lineHeight: 30 },
  display: { fontSize: 26, lineHeight: 34 },
  eyebrow: { fontSize: 13, lineHeight: 18, letterSpacing: 1.6 },
} as const
