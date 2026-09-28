import { colors, fontFamilies, iconSize, mapPalette, radius, sizes, space } from './tokens'

/* The tokens as CSS custom properties on :root, in the names the site's
   stylesheets use (--page, --ink-soft, --radius-small, --map-pin-top, ...).
   apps/web/scripts/build-tokens-css.ts writes this to ui/tokens.css before
   every dev server start and build, so the stylesheet never drifts. */

const kebab = (name: string) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)

/* The site's historical names where they differ from the token keys. */
const CSS_NAMES: Partial<Record<keyof typeof colors | keyof typeof radius, string>> = {
  card: 'radius',
  control: 'radius-small',
}

function declarations(prefix: string, group: Record<string, string | number>, unit = ''): string[] {
  return Object.entries(group).map(([key, value]) => {
    const name = CSS_NAMES[key as keyof typeof CSS_NAMES] ?? kebab(key)
    return `  --${prefix}${name}: ${typeof value === 'number' ? `${value}${unit}` : value};`
  })
}

export function tokensCss(): string {
  return [
    '/* Generated from @chatynkowo/theme by apps/web/scripts/build-tokens-css.ts — do not edit. */',
    ':root {',
    '  color-scheme: dark;',
    `  font-family: ${fontFamilies.body.css};`,
    `  --font-display: ${fontFamilies.display.css};`,
    '  font-synthesis: none;',
    '  text-rendering: optimizeLegibility;',
    ...declarations('', colors),
    ...declarations('', { card: radius.card, control: radius.control }, 'px'),
    ...declarations('space-', space, 'px'),
    ...declarations('', { headerHeight: sizes.header, controlSize: sizes.control, buttonHeight: sizes.button }, 'px'),
    ...declarations('icon-', iconSize, 'px'),
    ...declarations('map-', mapPalette),
    '  --shadow: 0 26px 72px rgb(3 12 9 / 0.42);',
    '}',
    '',
  ].join('\n')
}
