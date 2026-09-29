import { useEffect, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { useTranslation } from 'react-i18next'
import { FoundIcon, GlowPulse, SPRINGS, colors, iconSize, useReducedMotion } from '../../ui'

/* The seal of a fresh discovery: a gold round badge stamped over the hero's
   bottom edge. It springs from small to full size a beat after the story
   opens, with a glow breathing behind it; the parent answers the settled
   spring with a haptic. Under reduced motion it is simply there. */

export const SEAL_SIZE = 72
/* How far the seal overlaps the hero above it. */
export const SEAL_OVERLAP = SEAL_SIZE / 2
const STAMP_DELAY_MS = 250
const START_SCALE = 0.4

export function SealStamp({ onSettled }: { onSettled?: () => void }) {
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()
  const scale = useSharedValue(reduceMotion ? 1 : START_SCALE)

  /* The latest callback, read when the spring lands. */
  const settled = useRef(onSettled)
  useEffect(() => {
    settled.current = onSettled
  })

  useEffect(() => {
    const fire = () => settled.current?.()
    scale.value = withDelay(
      STAMP_DELAY_MS,
      withSpring(1, SPRINGS.gentle, (finished) => {
        if (finished) scheduleOnRN(fire)
      }),
    )
  }, [scale])

  const motion = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  return (
    <Animated.View style={[styles.wrap, motion]} accessibilityRole="image" accessibilityLabel={t('story.unlocked')}>
      <GlowPulse size={SEAL_SIZE}>
        <View style={styles.badge}>
          <FoundIcon size={iconSize.hero} weight="fill" color={colors.accentInk} />
        </View>
      </GlowPulse>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'flex-start',
    marginTop: -SEAL_OVERLAP,
  },
  badge: {
    width: SEAL_SIZE,
    height: SEAL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SEAL_SIZE / 2,
    borderWidth: 2,
    borderColor: colors.accentBorder,
    backgroundColor: colors.accent,
  },
})
