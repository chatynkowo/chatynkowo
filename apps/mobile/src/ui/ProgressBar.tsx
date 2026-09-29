import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { DURATIONS, EASING, ReduceMotion } from './motion'
import { colors, radius } from './tokens'

/* A 4 px bar with the ring's colours and timing, for rows too narrow for a
   ring (the compact quest card under 360 pt, the story unlock row). The
   fill sweeps from the previous value; the first render draws it in place. */
export function ProgressBar({ value, max }: { value: number; max: number }) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
  const [track, setTrack] = useState(0)
  const progress = useSharedValue(ratio)
  const mounted = useRef(false)

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      progress.value = ratio
      return
    }
    progress.value = withTiming(ratio, { duration: DURATIONS.reveal, easing: EASING.out, reduceMotion: ReduceMotion.System })
  }, [ratio, progress])

  const fillStyle = useAnimatedStyle(() => ({ width: track * progress.value }))

  const onLayout = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width)
    if (next !== track) setTrack(next)
  }

  return (
    <View style={styles.track} onLayout={onLayout} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max, now: value }}>
      <Animated.View style={[styles.fill, fillStyle]} />
    </View>
  )
}

const styles = StyleSheet.create({
  track: {
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.line,
    overflow: 'hidden',
  },
  fill: {
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.accentStrong,
  },
})
