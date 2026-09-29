import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { StyleSheet } from 'react-native'
import Animated, { cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'
import { Button } from './Button'
import type { Icon } from './icons'
import { EASING, ReduceMotion, enterUp } from './motion'
import { Text } from './Text'
import { colors, iconSize, space } from './tokens'

/* Nothing to show yet: an emblem, a heading, an explanation and at most one
   action. The three groups rise in one after another and the emblem keeps
   drifting up and down by three points; reduced motion shows the block in
   place with the emblem still. */

export type EmptyStateProps = {
  icon: Icon
  title: string
  body?: string
  action?: { label: string; onPress: () => void; icon?: ReactNode }
}

const FLOAT = 3
const FLOAT_HALF_MS = 1500
const STAGGER_MS = 60

export function EmptyState({ icon: Glyph, title, body, action }: EmptyStateProps) {
  const reduceMotion = useReducedMotion()
  const drift = useSharedValue(-FLOAT)

  useEffect(() => {
    if (reduceMotion) {
      drift.value = 0
      return
    }
    drift.value = -FLOAT
    drift.value = withRepeat(withTiming(FLOAT, { duration: FLOAT_HALF_MS, easing: EASING.inOut, reduceMotion: ReduceMotion.System }), -1, true)
    return () => cancelAnimation(drift)
  }, [reduceMotion, drift])

  const floatStyle = useAnimatedStyle(() => ({ transform: [{ translateY: drift.value }] }))

  return (
    <Animated.View style={styles.box} entering={enterUp(0)}>
      <Animated.View style={floatStyle}>
        <Glyph size={iconSize.emblem} weight="duotone" color={colors.accentStrong} />
      </Animated.View>
      <Animated.View style={styles.copy} entering={enterUp(STAGGER_MS)}>
        <Text variant="heading" align="center" accessibilityRole="header">
          {title}
        </Text>
        {body ? (
          <Text tone="soft" align="center">
            {body}
          </Text>
        ) : null}
      </Animated.View>
      {action ? (
        <Animated.View entering={enterUp(STAGGER_MS * 2)}>
          <Button variant="primary" icon={action.icon} onPress={action.onPress} style={styles.action}>
            {action.label}
          </Button>
        </Animated.View>
      ) : null}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    paddingVertical: space.xxl,
    paddingHorizontal: space.lg,
  },
  copy: {
    alignItems: 'center',
    gap: space.md,
  },
  action: {
    marginTop: space.sm,
  },
})
