import type { ReactNode } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native'
import { Link, type Href } from 'expo-router'
import { Text } from './Text'
import { colors, radius, sizes, space } from './tokens'

/* The app's buttons — the same three contracts as the site (ui/Button.tsx):
   - primary: the single main action of a view,
   - ghost:   secondary actions on the raised surface (default),
   - subtle:  tertiary actions, e.g. sign out.
   Use Button for actions, LinkButton for navigation that looks like a
   button, IconButton for icon-only controls (the accessible name is
   mandatory). */

export type ButtonVariant = 'primary' | 'ghost' | 'subtle'

export type ButtonProps = Omit<PressableProps, 'style' | 'children'> & {
  variant?: ButtonVariant
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

export function Button({ variant = 'ghost', children, icon, iconAfter, busy, block, disabled, style, ...rest }: ButtonProps) {
  const inactive = Boolean(disabled || busy)
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: Boolean(busy) }}
      disabled={inactive}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        block && styles.block,
        pressed && styles.pressed,
        inactive && styles.disabled,
        style,
      ]}
      {...rest}
    >
      {busy ? <ActivityIndicator color={variant === 'primary' ? colors.accentInk : colors.accentStrong} /> : icon}
      {typeof children === 'string' ? (
        <Text weight="bold" tone={labelTone[variant]} numberOfLines={1}>
          {children}
        </Text>
      ) : (
        children
      )}
      {iconAfter}
    </Pressable>
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

export function IconButton({ label, children, active, disabled, style, ...rest }: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled), selected: Boolean(active) }}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }) => [styles.icon, active && styles.iconActive, pressed && styles.pressed, disabled && styles.disabled, style]}
      {...rest}
    >
      <View pointerEvents="none">{children}</View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    minHeight: sizes.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingVertical: 11,
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
  pressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.92,
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
