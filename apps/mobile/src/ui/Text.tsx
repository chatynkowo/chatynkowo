import { Text as NativeText, Platform, StyleSheet, type TextProps as NativeTextProps } from 'react-native'
import { colors, fonts, typeScale } from './tokens'

/* The one text component of the app. Screens choose a variant (role) and a
   tone (colour); they never set a font family or size themselves. */

export type TextVariant = keyof typeof typeScale
export type TextTone = 'ink' | 'soft' | 'faint' | 'accent' | 'accentInk' | 'danger' | 'success'
export type TextWeight = 'regular' | 'italic' | 'semibold' | 'bold'

export type TextProps = NativeTextProps & {
  variant?: TextVariant
  tone?: TextTone
  weight?: TextWeight
  align?: 'left' | 'center' | 'right'
}

const toneColor: Record<TextTone, string> = {
  ink: colors.ink,
  soft: colors.inkSoft,
  faint: colors.inkFaint,
  accent: colors.accentStrong,
  accentInk: colors.accentInk,
  danger: colors.danger,
  success: colors.success,
}

/* The site has no 700 face of Cormorant: its "bold" copy is the 600 face,
   so both names resolve to it here. */
const weightFamily: Record<TextWeight, string> = {
  regular: fonts.body,
  italic: fonts.bodyItalic,
  semibold: fonts.semibold,
  bold: fonts.semibold,
}

/* How far the system text size may scale each role: body copy grows
   freely, chrome (titles, eyebrows, display) stays within its layout. A
   caller may override with the prop. */
const maxMultiplier: Record<TextVariant, number> = {
  display: 1.2,
  title: 1.2,
  heading: 1.35,
  eyebrow: 1.3,
  body: 1.6,
  small: 1.6,
  caption: 1.3,
  compact: 1.35,
  digit: 1.2,
  label: 1.2,
  micro: 1.2,
}

/* Display roles are the site's h1/h2 in Cinzel Decorative; heading is its
   h3 (Cormorant 600); the eyebrow is Cormorant 600 in spaced small
   capitals, accent coloured, as on every section header of the site; the
   caption is the map chrome's smaller eyebrow in the caller's colour; the
   digit is a plaque code's figure in the display face. */
const variantStyles = StyleSheet.create({
  small: typeScale.small,
  body: typeScale.body,
  compact: typeScale.compact,
  label: typeScale.label,
  micro: typeScale.micro,
  heading: { ...typeScale.heading, fontFamily: fonts.semibold },
  title: { ...typeScale.title, fontFamily: fonts.display },
  display: { ...typeScale.display, fontFamily: fonts.display },
  eyebrow: { ...typeScale.eyebrow, fontFamily: fonts.semibold, textTransform: 'uppercase', color: colors.accentStrong },
  caption: { ...typeScale.caption, fontFamily: fonts.semibold, textTransform: 'uppercase' },
  digit: { ...typeScale.digit, fontFamily: fonts.display },
})

/* The accents of Cinzel's capitals (Ś, Ż, Ó) rise above the tight line box
   of the display roles, and iOS clips a text's first line to the view: the
   box gets room above it, given back by a negative margin so the layout
   does not move. Sized for the largest system text size the role allows. */
const ACCENT_ROOM_EM = 0.3
const accentRoom: Partial<Record<TextVariant, number>> =
  Platform.OS === 'ios'
    ? {
        display: Math.ceil(typeScale.display.fontSize * maxMultiplier.display * ACCENT_ROOM_EM),
        title: Math.ceil(typeScale.title.fontSize * maxMultiplier.title * ACCENT_ROOM_EM),
      }
    : {}

function accentRoomStyle(room: number, style: TextProps['style']) {
  const flat = StyleSheet.flatten(style) ?? {}
  const paddingTop = flat.paddingTop ?? flat.paddingVertical ?? flat.padding ?? 0
  const marginTop = flat.marginTop ?? flat.marginVertical ?? flat.margin ?? 0
  if (typeof paddingTop !== 'number' || typeof marginTop !== 'number') return null
  return { paddingTop: paddingTop + room, marginTop: marginTop - room }
}

export function Text({ variant = 'body', tone, weight, align, style, maxFontSizeMultiplier, ...rest }: TextProps) {
  const fixedFace = variant === 'title' || variant === 'display' || variant === 'eyebrow' || variant === 'heading' || variant === 'caption' || variant === 'digit'
  const room = accentRoom[variant]
  return (
    <NativeText
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? maxMultiplier[variant]}
      style={[
        { color: colors.ink, fontFamily: fonts.body },
        variantStyles[variant],
        !fixedFace && weight ? { fontFamily: weightFamily[weight] } : null,
        tone ? { color: toneColor[tone] } : null,
        align ? { textAlign: align } : null,
        style,
        room ? accentRoomStyle(room, style) : null,
      ]}
      {...rest}
    />
  )
}
