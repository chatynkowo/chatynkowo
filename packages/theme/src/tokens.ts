/* The design tokens of Chatynkowo, in one place for both clients. The site
   renders them as CSS custom properties (apps/web/scripts/build-tokens-css.ts
   writes ui/tokens.css from `cssVariables`), the app reads the objects. A
   value changes here and nowhere else. */

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

/* One scale for every icon in both clients. Pick by role, not by taste:
   xs/sm inline with small text, md inside controls and next to body copy,
   lg for standalone controls, xl for section markers, hero and emblem for
   decorative headers. */
export const iconSize = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 28,
  hero: 34,
  emblem: 42,
} as const

export type IconSize = keyof typeof iconSize

/* The two families, as the site names them in CSS and as expo-font
   registers each face in the app (one name per weight, since React Native
   cannot synthesise weights). The site's "bold" copy is the 600 face. */
export const fontFamilies = {
  body: {
    css: "'Cormorant Garamond', Georgia, serif",
    regular: 'CormorantGaramond_400Regular',
    italic: 'CormorantGaramond_400Regular_Italic',
    semibold: 'CormorantGaramond_600SemiBold',
  },
  display: {
    css: "'Cinzel Decorative', Georgia, serif",
    bold: 'CinzelDecorative_700Bold',
  },
} as const

/* The site's type scale in pixels: body 18px / 1.55, meta copy at 0.78rem,
   subheadings (h3, panel titles, markdown headings) at 1.35rem, section
   headings in Cinzel with -0.025em tracking, eyebrows in small capitals
   spaced 0.13em. */
export const typeScale = {
  small: { fontSize: 14, lineHeight: 20 },
  body: { fontSize: 18, lineHeight: 28 },
  heading: { fontSize: 24, lineHeight: 30 },
  title: { fontSize: 26, lineHeight: 30, letterSpacing: -0.65 },
  display: { fontSize: 32, lineHeight: 35, letterSpacing: -0.8 },
  eyebrow: { fontSize: 14, lineHeight: 18, letterSpacing: 1.8 },
} as const

/* The expedition map's own palette: the parchment the tiles sit on, the
   dark chrome cards over it, the pins, the clusters, the search area and
   the parchment panel with its own buttons. */
export const mapPalette = {
  parchment: '#8c7751',
  parchmentTint: '#c0a46b',
  frame: '#2a2419',
  vignette: '#160f08',
  vignetteBorder: 'rgba(40, 29, 16, 0.58)',
  vignetteLine: 'rgba(230, 195, 122, 0.25)',
  glow: '#59724b',
  chrome: 'rgba(40, 32, 23, 0.92)',
  chromeBorder: 'rgba(225, 184, 99, 0.5)',
  chromeDivider: 'rgba(225, 184, 99, 0.25)',
  chromeInk: '#efdcab',
  chromeIcon: '#efcf82',
  pinBorder: '#f0cf7f',
  pinTop: '#7d3f27',
  pinBottom: '#45281c',
  pinInk: '#f4d37f',
  pinFoundBorder: '#d9edbd',
  pinFoundTop: '#517948',
  pinFoundBottom: '#294c36',
  pinFoundInk: '#e3f4c6',
  clusterBorder: '#edc671',
  clusterTop: '#76502a',
  clusterBottom: '#3d2a1d',
  clusterInk: '#f5d783',
  clusterHalo: 'rgba(225, 184, 99, 0.18)',
  searchArea: '#d2a64d',
  userDot: '#3d7fd9',
  userDotBorder: '#f6ecd3',
  userRing: 'rgba(77, 144, 210, 0.55)',
  userAccuracy: '#4d90d2',
  panel: '#dcc69a',
  panelBorder: '#b58b47',
  panelInk: '#48321f',
  panelText: '#4a3824',
  panelMuted: '#76572f',
  panelClose: 'rgba(250, 239, 211, 0.48)',
  panelCloseBorder: 'rgba(78, 54, 31, 0.28)',
  panelButtonBorder: '#775630',
  panelButtonInk: '#3e2d1d',
  clueFoundBorder: 'rgba(69, 101, 61, 0.3)',
  clueFound: 'rgba(74, 111, 62, 0.1)',
  clueFoundInk: '#3f5835',
  clueBorder: 'rgba(111, 76, 35, 0.28)',
  clue: 'rgba(138, 97, 43, 0.1)',
  clueInk: '#604421',
} as const

/* The three button contracts both clients implement:
   - primary: the single main action of a view,
   - ghost:   secondary actions on the raised surface (the default),
   - subtle:  tertiary actions, e.g. sign out.
   Icon-only controls require an accessible name. On the parchment panel
   the ghost button takes the panel's brown border and ink. */
export const BUTTON_VARIANTS = ['primary', 'ghost', 'subtle'] as const

export type ButtonVariant = (typeof BUTTON_VARIANTS)[number]
