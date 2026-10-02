import { useEffect } from 'react'
import { StyleSheet, View, type AccessibilityActionEvent, type LayoutChangeEvent } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { useTranslation } from 'react-i18next'
import { EASING, ReduceMotion, SPRINGS, Text, colors, radius, space } from '../../ui'

/* The recording's position as a bar with a thumb. Between two status
   reports the fill glides linearly so it never stutters; a finger on the bar
   takes over, the thumb swells while held, and the player seeks where it
   lets go. A tap seeks straight there. Assistive tech adjusts the position
   in steps of fifteen seconds. */

type ScrubBarProps = {
  /* Seconds. */
  position: number
  duration: number
  onSeek: (seconds: number) => void
  /* The accessible name of the control. */
  label: string
}

const BAR_HEIGHT = 10
const THUMB = 20
/* The touch area is taller than the bar it draws. */
const TOUCH_HEIGHT = 44
const GLIDE_MS = 500
const GRAB_SCALE = 1.3
export const SEEK_STEP_SECONDS = 15

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0')}`
}

function clamp01(value: number) {
  'worklet'
  return Math.min(1, Math.max(0, value))
}

export function ScrubBar({ position, duration, onSeek, label }: ScrubBarProps) {
  const { t } = useTranslation()
  /* 0 to 1 along the bar. */
  const progress = useSharedValue(duration > 0 ? clamp01(position / duration) : 0)
  const grabbed = useSharedValue(false)
  const width = useSharedValue(0)
  const thumbScale = useSharedValue(1)

  /* Each status report glides the fill to the new position, unless a finger
     holds it. */
  useEffect(() => {
    if (grabbed.value) return
    const ratio = duration > 0 ? clamp01(position / duration) : 0
    progress.value = withTiming(ratio, { duration: GLIDE_MS, easing: EASING.linear, reduceMotion: ReduceMotion.System })
  }, [position, duration, progress, grabbed])

  const seekToRatio = (ratio: number) => {
    if (duration > 0) onSeek(clamp01(ratio) * duration)
  }

  const pan = Gesture.Pan()
    .onStart((event) => {
      grabbed.value = true
      thumbScale.value = withSpring(GRAB_SCALE, SPRINGS.snappy)
      if (width.value > 0) progress.value = clamp01(event.x / width.value)
    })
    .onUpdate((event) => {
      if (width.value > 0) progress.value = clamp01(event.x / width.value)
    })
    .onEnd(() => {
      scheduleOnRN(seekToRatio, progress.value)
    })
    .onFinalize(() => {
      grabbed.value = false
      thumbScale.value = withSpring(1, SPRINGS.gentle)
    })

  const tap = Gesture.Tap().onEnd((event) => {
    if (width.value <= 0) return
    const ratio = clamp01(event.x / width.value)
    progress.value = ratio
    scheduleOnRN(seekToRatio, ratio)
  })

  const gesture = Gesture.Exclusive(pan, tap)

  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }))
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * Math.max(0, width.value - THUMB) }, { scale: thumbScale.value }],
  }))

  const onAccessibilityAction = ({ nativeEvent }: AccessibilityActionEvent) => {
    if (nativeEvent.actionName === 'increment') onSeek(Math.min(duration, position + SEEK_STEP_SECONDS))
    if (nativeEvent.actionName === 'decrement') onSeek(Math.max(0, position - SEEK_STEP_SECONDS))
  }

  return (
    <View style={styles.wrap}>
      <GestureDetector gesture={gesture}>
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={label}
          accessibilityValue={{ min: 0, max: Math.round(duration), now: Math.round(position), text: `${formatTime(position)} / ${formatTime(duration)}` }}
          accessibilityActions={[
            { name: 'increment', label: t('mobile:story.seekForward') },
            { name: 'decrement', label: t('mobile:story.seekBack') },
          ]}
          onAccessibilityAction={onAccessibilityAction}
          onLayout={(event: LayoutChangeEvent) => {
            width.value = event.nativeEvent.layout.width
          }}
          style={styles.touch}
        >
          <View style={styles.bar}>
            <Animated.View style={[styles.fill, fillStyle]} />
          </View>
          <Animated.View pointerEvents="none" style={[styles.thumb, thumbStyle]} />
        </View>
      </GestureDetector>
      <Text variant="small" tone="faint">
        {formatTime(position)} / {formatTime(duration)}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    gap: space.xs,
  },
  touch: {
    height: TOUCH_HEIGHT,
    justifyContent: 'center',
  },
  bar: {
    height: BAR_HEIGHT,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSoft,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  thumb: {
    position: 'absolute',
    left: 0,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: 2,
    borderColor: colors.accentBorder,
    backgroundColor: colors.accentStrong,
  },
})
