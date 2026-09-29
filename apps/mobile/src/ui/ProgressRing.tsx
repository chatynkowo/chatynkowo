import { useEffect, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import Svg, { Circle, type CircleProps } from 'react-native-svg'
import { DURATIONS, EASING, ReduceMotion } from './motion'
import { Text } from './Text'
import { colors } from './tokens'

/* Finds out of the total as a ring: the quest card on the Atlas, the
   Kronika header, the story unlock row. The arc sweeps from its previous
   value to the new one over the reveal duration and tells the caller when
   it has settled (for a haptic). The first render draws the value in place;
   only real changes animate. */

export type ProgressRingProps = {
  size: 24 | 34 | 40 | 56 | 64
  value: number
  max: number
  /* Ring thickness; a tenth of the size by default. */
  stroke?: number
  /* Centre text, small semibold. */
  label?: string
  /* Called when the sweep has finished (used for a haptic). */
  onSettled?: () => void
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

export function ProgressRing({ size, value, max, stroke = size / 10, label, onSettled }: ProgressRingProps) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius

  /* The shared value outlives renders, so a change sweeps from where the
     ring was, not from zero. */
  const progress = useSharedValue(ratio)
  const mounted = useRef(false)
  const settled = useRef(onSettled)
  settled.current = onSettled

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      progress.value = ratio
      return
    }
    const notify = () => settled.current?.()
    progress.value = withTiming(ratio, { duration: DURATIONS.reveal, easing: EASING.out, reduceMotion: ReduceMotion.System }, (finished) => {
      'worklet'
      if (finished) scheduleOnRN(notify)
    })
  }, [ratio, progress])

  const arcProps = useAnimatedProps<CircleProps>(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }))

  return (
    <View
      style={[styles.box, { width: size, height: size }]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max, now: value }}
      accessibilityLabel={label}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={colors.line} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          animatedProps={arcProps}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.accentStrong}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      {label ? (
        <View style={styles.label} pointerEvents="none">
          <Text variant="small" weight="semibold" numberOfLines={1} maxFontSizeMultiplier={1.2} style={size < 40 ? styles.tiny : undefined}>
            {label}
          </Text>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tiny: {
    fontSize: 10,
    lineHeight: 12,
  },
})
