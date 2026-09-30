import type { ReactNode } from 'react'
import { ActivityIndicator, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native'
import { Link, type Href } from 'expo-router'
import { PressableScale } from './PressableScale'
import { Text } from './Text'
import { colors, mapPalette, radius, sizes, space, typeScale, type ButtonVariant } from './tokens'

/* The app's buttons — the three contracts of @chatynkowo/theme, the same
   the site implements in ui/Button.tsx and ui.css:
   - primary: the single main action of a view,
   - ghost:   secondary actions on the raised surface (default),
   - subtle:  tertiary actions, e.g. sign out.
   Use Button for actions, LinkButton for navigation that looks like a
   button, IconButton for icon-only controls (the accessible name is
   mandatory). On the parchment surface (the map's cottage panel) the ghost
   button takes the panel's brown border and ink, as on the site. All three
   press through PressableScale: the primary action answers with a light
   tap, icon controls with a selection tick, the quieter variants silently. */

export type { ButtonVariant }

export type ButtonSurface = 'dark' | 'parchment'

export type ButtonProps = Omit<PressableProps, 'style' | 'children'> & {
  variant?: ButtonVariant
  /* What the button sits on; only the ghost variant changes with it. */
  surface?: ButtonSurface
  /* A string becomes the label; anything else is rendered as given. */
  children: ReactNode
  /* Icons from the vocabulary, before and after the label. */
  icon?: ReactNode
  iconAfter?: ReactNode
  /* Replaces the leading icon with a spinner and disables the control. */
  busy?: boolean
  /* Stretches to the container's width. */
  block?: boolean
  style?: StyleProp<ViewStyle>
}

const labelTone: Record<ButtonVariant, 'accentInk' | 'ink' | 'soft'> = {
  primary: 'accentInk',
  ghost: 'ink',
  subtle: 'soft',
}

export function Button({ variant = 'ghost', surface = 'dark', children, icon, iconAfter, busy, block, disabled, style, ...rest }: ButtonProps) {
  const inactive = Boolean(disabled || busy)
  const onParchment = surface === 'parchment' && variant === 'ghost'
  const primary = variant === 'primary'
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: Boolean(busy) }}
      disabled={inactive}
      haptic={primary ? 'light' : null}
      /* The accent wash is invisible on the gold face; the lighter border
         gold reads as a pressed shade there. */
      pressedFill={primary ? colors.accentBorder : colors.accentWash}
      style={[styles.base, styles[variant], onParchment && styles.ghostOnParchment, block && styles.block, inactive && styles.disabled, style]}
      {...rest}
    >
      {busy ? <ActivityIndicator color={primary ? colors.accentInk : colors.accentStrong} /> : icon}
      {typeof children === 'string' ? (
        <Text weight="bold" tone={labelTone[variant]} numberOfLines={1} style={onParchment ? styles.ghostOnParchmentLabel : undefined}>
          {children}
        </Text>
      ) : (
        children
      )}
      {iconAfter}
    </PressableScale>
  )
}

export type LinkButtonProps = ButtonProps & { href: Href }

/* Navigation that looks like a button; expo-router handles the transition. */
export function LinkButton({ href, ...rest }: LinkButtonProps) {
  return (
    <Link href={href} asChild>
      <Button {...rest} />
    </Link>
  )
}

export type IconButtonProps = Omit<PressableProps, 'style' | 'children'> & {
  /* What the control does — read by assistive tech. */
  label: string
  children: ReactNode
  /* Highlights the control, e.g. an active toggle. */
  active?: boolean
  style?: StyleProp<ViewStyle>
}

/* 42 pt control plus the slop makes the 48 pt target. */
export function IconButton({ label, children, active, disabled, style, ...rest }: IconButtonProps) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled), selected: Boolean(active) }}
      disabled={disabled}
      haptic="select"
      hitSlop={6}
      style={[styles.icon, active && styles.iconActive, disabled && styles.disabled, style]}
      {...rest}
    >
      <View pointerEvents="none">{children}</View>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  base: {
    minHeight: sizes.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    /* The body line (28) plus the paddings and the hairline borders make
       exactly the button height; a larger text size grows it. */
    paddingVertical: (sizes.button - typeScale.body.lineHeight) / 2 - 1,
    paddingHorizontal: 19,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: radius.control,
    alignSelf: 'flex-start',
  },
  block: {
    alignSelf: 'stretch',
  },
  primary: {
    backgroundColor: colors.accent,
    borderColor: colors.accentBorder,
  },
  ghost: {
    backgroundColor: colors.ghost,
    borderColor: colors.lineStrong,
  },
  subtle: {
    backgroundColor: 'transparent',
    borderColor: colors.line,
  },
  ghostOnParchment: {
    backgroundColor: 'transparent',
    borderColor: mapPalette.panelButtonBorder,
  },
  ghostOnParchmentLabel: {
    color: mapPalette.panelButtonInk,
  },
  disabled: {
    opacity: 0.7,
  },
  icon: {
    width: sizes.control,
    height: sizes.control,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.control,
    backgroundColor: colors.surface,
    padding: space.xs,
  },
  iconActive: {
    borderColor: colors.lineStrong,
    backgroundColor: colors.accentWash,
  },
})
