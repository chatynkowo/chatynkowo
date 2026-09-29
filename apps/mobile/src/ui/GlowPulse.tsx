import type { ReactNode } from 'react'
import { useCallback, useEffect } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg'
import Animated, { cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated'
import { EASING, ReduceMotion, SPRINGS } from './motion'
import { colors } from './tokens'

/* A soft gold halo behind a seal, a reward card or the podium winner,
   breathing a few times when it appears: a radial gradient of the accent,
   twice the child's size, whose opacity rises to a third and falls back per
   cycle. Under reduced motion the halo stays dark. */

export type GlowPulseProps = {
  /* Diameter of the child; the halo is drawn twice as large. */
  size: number
  /* How many times the halo breathes; two by default. */
  cycles?: number
  /* False keeps the halo dark without unmounting the child (a card whose
     highlight arrives after its layout). */
  active?: boolean
  children: ReactNode
}

const PEAK_OPACITY = 0.35
const HALF_CYCLE_MS = 600

export function GlowPulse({ size, cycles = 2, active = true, children }: GlowPulseProps) {
  const reduceMotion = useReducedMotion()
  const opacity = useSharedValue(0)
  const halo = size * 2

  useEffect(() => {
    if (reduceMotion || !active) {
      opacity.value = 0
      return
    }
    opacity.value = withRepeat(
      withSequence(
        withTiming(PEAK_OPACITY, { duration: HALF_CYCLE_MS, easing: EASING.inOut, reduceMotion: ReduceMotion.System }),
        withTiming(0, { duration: HALF_CYCLE_MS, easing: EASING.inOut, reduceMotion: ReduceMotion.System }),
      ),
      cycles,
      false,
    )
    return () => cancelAnimation(opacity)
  }, [cycles, reduceMotion, active, opacity])

  const haloStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))

  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <Animated.View pointerEvents="none" style={[styles.halo, { width: halo, height: halo, top: -size / 2, left: -size / 2 }, haloStyle]}>
        <Svg width={halo} height={halo} viewBox="0 0 100 100">
          <Defs>
            <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={colors.accent} stopOpacity={1} />
              <Stop offset="0.55" stopColor={colors.accent} stopOpacity={0.35} />
              <Stop offset="1" stopColor={colors.accent} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={100} height={100} fill="url(#glow)" />
        </Svg>
      </Animated.View>
      {children}
    </View>
  )
}

/* One-shot pulse for a view that already exists (a Kronika card that just
   turned new): spread `style` on an Animated.View or a PressableScale and
   call `trigger()` when the moment comes. The view swells a little and
   springs back; nothing happens under reduced motion. */
export function usePulseOnce(): { style: StyleProp<ViewStyle>; trigger: () => void } {
  const reduceMotion = useReducedMotion()
  const scale = useSharedValue(1)

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  const trigger = useCallback(() => {
    if (reduceMotion) return
    scale.value = withSequence(
      withTiming(1.04, { duration: 220, easing: EASING.out, reduceMotion: ReduceMotion.System }),
      withSpring(1, SPRINGS.gentle),
    )
  }, [reduceMotion, scale])

  /* The animated style only moves on an Animated component; on a plain View
     it is the resting style, which is the contract's static fallback. */
  return { style: style as StyleProp<ViewStyle>, trigger }
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
  },
})
