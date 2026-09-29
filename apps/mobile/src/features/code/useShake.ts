import { useCallback } from 'react'
import { ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated'

/* The "no" of the pin row: a short horizontal shake, 320 ms in all. Under
   reduced motion the row stays still and the border colour carries the
   message on its own. */

const STEP_MS = 64
const OFFSETS = [-8, 8, -5, 5, 0]

export const SHAKE_MS = STEP_MS * OFFSETS.length

export function useShake() {
  const reduceMotion = useReducedMotion()
  const translateX = useSharedValue(0)

  const shake = useCallback(() => {
    if (reduceMotion) return
    translateX.value = withSequence(...OFFSETS.map((offset) => withTiming(offset, { duration: STEP_MS, reduceMotion: ReduceMotion.System })))
  }, [reduceMotion, translateX])

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }))

  return { style, shake }
}
