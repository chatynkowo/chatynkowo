import {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  FadeOutDown,
  FadeOutUp,
  LinearTransition,
  ReduceMotion,
} from 'react-native-reanimated'

/* The motion vocabulary of the app: a few springs, a few durations, two
   easings and the entering/exiting presets built from them. Every animation
   in the app takes its numbers from here so the whole interface moves at one
   tempo, and every preset honours the system's reduce motion setting. Loops
   and staggers read `useReducedMotion()` themselves and collapse to a static
   state or a single fade. */

export const SPRINGS = {
  gentle: { damping: 20, stiffness: 140, reduceMotion: ReduceMotion.System },
  settle: { damping: 22, stiffness: 220, mass: 0.9, reduceMotion: ReduceMotion.System },
  snappy: { damping: 26, stiffness: 320, reduceMotion: ReduceMotion.System },
  reveal: { damping: 18, stiffness: 160, reduceMotion: ReduceMotion.System },
} as const

export const DURATIONS = { fast: 160, base: 240, slow: 420, reveal: 700 } as const

export const EASING = {
  out: Easing.out(Easing.cubic),
  inOut: Easing.inOut(Easing.cubic),
  linear: Easing.linear,
} as const

export { ReduceMotion, useReducedMotion } from 'react-native-reanimated'

/* Preset builders for `entering`, `exiting` and `layout` props. */
export const enterUp = (delay = 0) => FadeInUp.duration(DURATIONS.base).easing(EASING.out).delay(delay).reduceMotion(ReduceMotion.System)
export const enterDown = (delay = 0) => FadeInDown.duration(DURATIONS.base).easing(EASING.out).delay(delay).reduceMotion(ReduceMotion.System)
export const leaveUp = () => FadeOutUp.duration(DURATIONS.fast).reduceMotion(ReduceMotion.System)
export const leaveDown = () => FadeOutDown.duration(DURATIONS.fast).reduceMotion(ReduceMotion.System)
export const fade = (duration: number = DURATIONS.base) => FadeIn.duration(duration).reduceMotion(ReduceMotion.System)
export const leave = () => FadeOut.duration(DURATIONS.fast).reduceMotion(ReduceMotion.System)
export const layoutLinear = LinearTransition.duration(DURATIONS.base).reduceMotion(ReduceMotion.System)
