import { Text as NativeText, StyleSheet, type TextProps as NativeTextProps } from 'react-native'
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

const weightFamily: Record<TextWeight, string> = {
  regular: fonts.body,
  italic: fonts.bodyItalic,
  semibold: fonts.semibold,
  bold: fonts.bold,
}

/* Display roles use Cinzel; the eyebrow is small caps in the accent colour,
   as on the site's section headers. */
const variantStyles = StyleSheet.create({
  small: typeScale.small,
  body: typeScale.body,
  lead: typeScale.lead,
  heading: { ...typeScale.heading, fontFamily: fonts.bold },
  title: { ...typeScale.title, fontFamily: fonts.display },
  display: { ...typeScale.display, fontFamily: fonts.displayBlack },
  eyebrow: { ...typeScale.eyebrow, fontFamily: fonts.display, textTransform: 'uppercase', color: colors.accentStrong },
})

export function Text({ variant = 'body', tone, weight, align, style, ...rest }: TextProps) {
  const isDisplay = variant === 'title' || variant === 'display' || variant === 'eyebrow' || variant === 'heading'
  return (
    <NativeText
      style={[
        { color: colors.ink, fontFamily: fonts.body },
        variantStyles[variant],
        !isDisplay && weight ? { fontFamily: weightFamily[weight] } : null,
        tone ? { color: toneColor[tone] } : null,
        align ? { textAlign: align } : null,
        style,
      ]}
      {...rest}
    />
  )
}
