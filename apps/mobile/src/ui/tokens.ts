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
   React Native cannot synthesise weights for custom fonts). The site loads
   exactly these faces: Cormorant Garamond 400, 400 italic and 600 for the
   body, Cinzel Decorative 700 for headings — so "bold" copy is the 600 face
   here as well. */
export const fonts = {
  body: 'CormorantGaramond_400Regular',
  bodyItalic: 'CormorantGaramond_400Regular_Italic',
  semibold: 'CormorantGaramond_600SemiBold',
  display: 'CinzelDecorative_700Bold',
} as const

/* The site's type scale in device pixels: body 18px / 1.55, meta copy at
   0.78rem, subheadings (h3, the cottage panel, markdown headings) at
   1.35rem, section headings in Cinzel with -0.025em tracking, eyebrows in
   small capitals spaced 0.13em. */
export const typeScale = {
  small: { fontSize: 14, lineHeight: 20 },
  body: { fontSize: 18, lineHeight: 28 },
  heading: { fontSize: 24, lineHeight: 30 },
  title: { fontSize: 26, lineHeight: 30, letterSpacing: -0.65 },
  display: { fontSize: 32, lineHeight: 35, letterSpacing: -0.8 },
  eyebrow: { fontSize: 14, lineHeight: 18, letterSpacing: 1.8 },
} as const
