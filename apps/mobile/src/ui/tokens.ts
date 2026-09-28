/* The app's design tokens are the shared ones in @chatynkowo/theme — the
   same values the site turns into CSS custom properties — re-exported
   here so the interface layer keeps one import path. `fonts` maps the
   theme's font families to the names expo-font registers (see fonts.ts). */
import { fontFamilies } from '@chatynkowo/theme'

export { colors, iconSize, mapPalette, radius, sizes, space, typeScale, type ButtonVariant, type IconSize } from '@chatynkowo/theme'

export const fonts = {
  body: fontFamilies.body.regular,
  bodyItalic: fontFamilies.body.italic,
  semibold: fontFamilies.body.semibold,
  display: fontFamilies.display.bold,
} as const
