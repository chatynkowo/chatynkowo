import type { ReactNode } from 'react'
import { Platform, Pressable, StyleSheet, type GestureResponderEvent, type PressableProps, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated'
import { DURATIONS, ReduceMotion, SPRINGS } from './motion'
import { colors } from './tokens'

/* The one pressable of the app: everything that reacts to a finger (buttons,
   rows, cards, map controls) is built on it so the press feel is decided
   once. A finger down shrinks the control on a quick spring and, on iOS,
   raises a tinted fill behind the content; Android draws its ripple over the
   content instead. Reduced motion keeps the fill and drops the scale. No
   haptic: the phone only stirs for a discovery (src/lib/haptics.ts). */

export type PressableScaleProps = Omit<PressableProps, 'style' | 'children'> & {
  /* How far the control shrinks while pressed. */
  scaleTo?: number
  /* iOS overlay colour while pressed; 'transparent' disables it. */
  pressedFill?: string
  /* Android ripple in the accent wash, drawn over the content. */
  ripple?: boolean
  style?: StyleProp<ViewStyle>
  children: ReactNode
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

const RIPPLE = { color: colors.accentWash, foreground: true } as const

/* The pressed fill sits inside the border, so its corners are the control's
   corners minus the border width. */
function fillCorners(style: StyleProp<ViewStyle>): ViewStyle {
  const flat = StyleSheet.flatten(style) ?? {}
  const border = typeof flat.borderWidth === 'number' ? flat.borderWidth : 0
  const inner = (value: unknown) => (typeof value === 'number' ? Math.max(0, value - border) : undefined)
  return {
    borderRadius: inner(flat.borderRadius),
    borderTopLeftRadius: inner(flat.borderTopLeftRadius),
    borderTopRightRadius: inner(flat.borderTopRightRadius),
    borderBottomLeftRadius: inner(flat.borderBottomLeftRadius),
    borderBottomRightRadius: inner(flat.borderBottomRightRadius),
  }
}

export function PressableScale({
  scaleTo = 0.97,
  pressedFill = colors.accentWash,
  ripple = true,
  style,
  children,
  disabled,
  onPressIn,
  onPressOut,
  accessibilityRole = 'button',
  ...rest
}: PressableScaleProps) {
  const reduceMotion = useReducedMotion()
  const scale = useSharedValue(1)
  const fill = useSharedValue(0)

  const useRipple = ripple && Platform.OS === 'android'
  /* The fill is the iOS feedback; Android gets it only when the ripple is off. */
  const showFill = pressedFill !== 'transparent' && !useRipple

  const pressIn = (event: GestureResponderEvent) => {
    if (!disabled) {
      if (!reduceMotion) scale.value = withSpring(scaleTo, SPRINGS.snappy)
      fill.value = withTiming(1, { duration: DURATIONS.fast, reduceMotion: ReduceMotion.System })
    }
    onPressIn?.(event)
  }

  const pressOut = (event: GestureResponderEvent) => {
    scale.value = withSpring(1, SPRINGS.gentle)
    fill.value = withTiming(0, { duration: DURATIONS.fast, reduceMotion: ReduceMotion.System })
    onPressOut?.(event)
  }

  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  const fillStyle = useAnimatedStyle(() => ({ opacity: fill.value }))

  return (
    <AnimatedPressable
      accessibilityRole={accessibilityRole}
      disabled={disabled}
      android_ripple={useRipple ? RIPPLE : undefined}
      onPressIn={pressIn}
      onPressOut={pressOut}
      style={[style, useRipple && styles.clipRipple, scaleStyle]}
      {...rest}
    >
      {showFill ? <Animated.View pointerEvents="none" style={[styles.fill, fillCorners(style), { backgroundColor: pressedFill }, fillStyle]} /> : null}
      {children}
    </AnimatedPressable>
  )
}

const styles = StyleSheet.create({
  /* The ripple is a rectangle; clipping keeps it inside rounded corners. */
  clipRipple: {
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
})
