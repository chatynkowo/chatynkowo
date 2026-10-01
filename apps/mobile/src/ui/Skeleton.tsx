import { useEffect, useState } from 'react'
import { StyleSheet, View, type DimensionValue, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, { cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated'
import { EASING, ReduceMotion } from './motion'
import { colors, mapPalette, radius, space, withAlpha } from './tokens'

/* Placeholders for content that is still loading: a block, a leaderboard
   row, a Kronika grid cell and the whole map. A faint strip of light sweeps
   each block; the map, too large for a sweep, breathes instead. Reduced
   motion holds every placeholder still at its resting opacity. */

const SHIMMER_MS = 1200
const BREATH_MS = 900
const REST_OPACITY = 0.7

/* The ink at eight percent: the light of the sweep. */
const SWEEP = ['transparent', withAlpha(colors.ink, 0.08), 'transparent'] as const

export function Skeleton({ width, height, radius: corner = radius.control, style }: { width: DimensionValue; height: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  const reduceMotion = useReducedMotion()
  const [measured, setMeasured] = useState(0)
  const shift = useSharedValue(0)

  /* The strip is 60 percent of the block and travels from fully outside on
     the left to fully outside on the right, then starts over. */
  const strip = Math.max(48, measured * 0.6)

  useEffect(() => {
    if (reduceMotion || measured <= 0) return
    shift.value = -strip
    shift.value = withRepeat(withTiming(measured, { duration: SHIMMER_MS, easing: EASING.linear, reduceMotion: ReduceMotion.System }), -1, false)
    return () => cancelAnimation(shift)
  }, [measured, strip, reduceMotion, shift])

  const sweepStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shift.value }] }))

  const onLayout = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width)
    if (next !== measured) setMeasured(next)
  }

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={onLayout}
      style={[styles.block, reduceMotion && styles.rest, { width, height, borderRadius: corner }, style]}
    >
      {!reduceMotion && measured > 0 ? (
        <Animated.View pointerEvents="none" style={[styles.sweep, { width: strip }, sweepStyle]}>
          <LinearGradient colors={SWEEP} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.gradient} />
        </Animated.View>
      ) : null}
    </View>
  )
}

/* A 40 px circle and two lines, the shape of a leaderboard row. */
export function SkeletonRow() {
  return (
    <View style={styles.row}>
      <Skeleton width={40} height={40} radius={radius.pill} />
      <View style={styles.lines}>
        <Skeleton width="60%" height={14} />
        <Skeleton width="35%" height={12} />
      </View>
    </View>
  )
}

/* A square and a line, the shape of a Kronika grid cell. */
export function SkeletonCard() {
  return (
    <View style={styles.card}>
      <Skeleton width="100%" height={120} radius={radius.card} />
      <Skeleton width="70%" height={14} />
    </View>
  )
}

/* The parchment the map tiles will sit on, with ghosted outlines where the
   quest card and the level card will appear. The outlines breathe between
   half and near-full opacity until the first download lands. */
export function SkeletonMap() {
  const reduceMotion = useReducedMotion()
  const breath = useSharedValue(REST_OPACITY)

  useEffect(() => {
    if (reduceMotion) {
      breath.value = REST_OPACITY
      return
    }
    breath.value = withRepeat(
      withSequence(
        withTiming(0.9, { duration: BREATH_MS, easing: EASING.inOut, reduceMotion: ReduceMotion.System }),
        withTiming(0.5, { duration: BREATH_MS, easing: EASING.inOut, reduceMotion: ReduceMotion.System }),
      ),
      -1,
      false,
    )
    return () => cancelAnimation(breath)
  }, [reduceMotion, breath])

  const breathStyle = useAnimatedStyle(() => ({ opacity: breath.value }))

  return (
    <View style={styles.map} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.mapChrome, breathStyle]}>
        <View style={[styles.ghost, styles.ghostQuest]} />
        <View style={[styles.ghost, styles.ghostLevel]} />
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  rest: {
    opacity: REST_OPACITY,
  },
  sweep: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
  },
  gradient: {
    flex: 1,
  },
  row: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
  },
  lines: {
    flex: 1,
    gap: space.sm,
  },
  card: {
    gap: space.sm,
  },
  map: {
    flex: 1,
    backgroundColor: mapPalette.parchment,
  },
  mapChrome: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: space.lg,
    paddingTop: space.xxl * 2,
  },
  ghost: {
    borderWidth: 1,
    borderColor: mapPalette.chromeBorder,
    backgroundColor: mapPalette.chrome,
    borderRadius: radius.control,
  },
  ghostQuest: {
    width: '58%',
    height: 62,
  },
  ghostLevel: {
    width: 84,
    height: 46,
  },
})
