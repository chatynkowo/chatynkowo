import { useEffect } from 'react'
import { StyleSheet } from 'react-native'
import Animated, { cancelAnimation, interpolateColor, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated'
import { DURATIONS, EASING, ReduceMotion, colors, radius, useReducedMotion } from '../../ui'

/* Where to hold the plaque's code: four gold corner marks around a square
   window that breathe while the camera looks. A read flashes the window, a
   foreign QR blinks the corners red once, an unknown code pulses them red.
   The scanner itself reads the whole frame; the marks only guide the hand. */

export type ViewfinderState = 'idle' | 'success' | 'miss' | 'error'

export const VIEWFINDER_SIZE = 240
const LEG = 24
const STROKE = 3
const BREATH_SCALE = 1.02
const BREATH_MS = 900
const FLASH_MS = 220
const FLASH_PEAK = 0.28
const MISS_IN_MS = 100
const MISS_OUT_MS = 500
const ERROR_PULSE_MS = 200
const ERROR_PULSES = 3
const ERROR_LOW = 0.4

export function ScannerViewfinder({ state }: { state: ViewfinderState }) {
  const reduceMotion = useReducedMotion()
  const breath = useSharedValue(1)
  /* 0 is the accent, 1 the danger colour. */
  const tint = useSharedValue(0)
  const flash = useSharedValue(0)

  useEffect(() => {
    cancelAnimation(breath)
    if (reduceMotion || state !== 'idle') {
      breath.value = withTiming(1, { duration: DURATIONS.fast, reduceMotion: ReduceMotion.System })
      return
    }
    breath.value = withRepeat(
      withSequence(
        withTiming(BREATH_SCALE, { duration: BREATH_MS, easing: EASING.inOut, reduceMotion: ReduceMotion.System }),
        withTiming(1, { duration: BREATH_MS, easing: EASING.inOut, reduceMotion: ReduceMotion.System }),
      ),
      -1,
      false,
    )
  }, [state, reduceMotion, breath])

  useEffect(() => {
    cancelAnimation(tint)
    cancelAnimation(flash)
    const to = (value: number, duration: number) => withTiming(value, { duration, reduceMotion: ReduceMotion.System })
    /* A short fade that must show even under reduced motion (a jump would
       hide the read and the miss entirely). */
    const brief = (value: number) => withTiming(value, { duration: DURATIONS.fast, reduceMotion: ReduceMotion.Never })
    switch (state) {
      case 'idle':
        tint.value = to(0, DURATIONS.fast)
        flash.value = to(0, DURATIONS.fast)
        return
      case 'success':
        tint.value = to(0, DURATIONS.fast)
        flash.value = reduceMotion ? withSequence(brief(FLASH_PEAK), brief(0)) : withSequence(to(FLASH_PEAK, FLASH_MS * 0.4), to(0, FLASH_MS * 0.6))
        return
      case 'miss':
        tint.value = reduceMotion ? withSequence(brief(1), brief(0)) : withSequence(to(1, MISS_IN_MS), to(0, MISS_OUT_MS))
        return
      case 'error':
        tint.value = reduceMotion
          ? to(1, DURATIONS.fast)
          : withSequence(withRepeat(withSequence(to(1, ERROR_PULSE_MS), to(ERROR_LOW, ERROR_PULSE_MS)), ERROR_PULSES, false), to(1, ERROR_PULSE_MS))
        return
    }
  }, [state, reduceMotion, tint, flash])

  const windowStyle = useAnimatedStyle(() => ({ transform: [{ scale: breath.value }] }))
  const cornerStyle = useAnimatedStyle(() => ({ borderColor: interpolateColor(tint.value, [0, 1], [colors.accentStrong, colors.danger]) }))
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }))

  return (
    <Animated.View pointerEvents="none" style={[styles.window, windowStyle]}>
      <Animated.View style={[styles.flash, flashStyle]} />
      <Animated.View style={[styles.corner, styles.topLeft, cornerStyle]} />
      <Animated.View style={[styles.corner, styles.topRight, cornerStyle]} />
      <Animated.View style={[styles.corner, styles.bottomLeft, cornerStyle]} />
      <Animated.View style={[styles.corner, styles.bottomRight, cornerStyle]} />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  window: {
    width: VIEWFINDER_SIZE,
    height: VIEWFINDER_SIZE,
  },
  flash: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: radius.control,
    backgroundColor: colors.accentStrong,
  },
  corner: {
    position: 'absolute',
    width: LEG,
    height: LEG,
    borderColor: colors.accentStrong,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: STROKE,
    borderLeftWidth: STROKE,
    borderTopLeftRadius: radius.control / 2,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: STROKE,
    borderRightWidth: STROKE,
    borderTopRightRadius: radius.control / 2,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: STROKE,
    borderLeftWidth: STROKE,
    borderBottomLeftRadius: radius.control / 2,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: STROKE,
    borderRightWidth: STROKE,
    borderBottomRightRadius: radius.control / 2,
  },
})
