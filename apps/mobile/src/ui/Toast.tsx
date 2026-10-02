import { StyleSheet, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { FadeInDown, FadeInUp, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useActiveToast, useToast, useToastClearance, useToastTimer, type ActiveToast, type ToastTone } from '../providers/ToastProvider'
import { FoundIcon, ShieldIcon, SyncIcon, WarningIcon, type Icon } from './icons'
import { DURATIONS, ReduceMotion, SPRINGS, leaveDown, leaveUp } from './motion'
import { PressableScale } from './PressableScale'
import { useTabBarHeight } from './TabBar'
import { Text } from './Text'
import { colors, iconSize, radius, space } from './tokens'

/* The pill that shows the current toast, mounted once after the root Stack.
   It springs in from the edge it hangs on (the status bar, or the bottom
   above the Atlas chrome), can be flicked back towards that edge, holds
   its timer while a finger rests on it and leaves the way it came. A newer
   toast replaces the pill outright. */


const toneIcon: Record<ToastTone, Icon> = {
  info: SyncIcon,
  success: FoundIcon,
  warning: WarningIcon,
  error: ShieldIcon,
}

const toneBorder: Record<ToastTone, string> = {
  info: colors.lineStrong,
  success: colors.success,
  warning: colors.accentBorder,
  error: colors.danger,
}

const toneInk: Record<ToastTone, string> = {
  info: colors.accentStrong,
  success: colors.success,
  warning: colors.accentStrong,
  error: colors.danger,
}

/* A flick past this distance or speed, towards the edge, dismisses. */
const DISMISS_DISTANCE = 24
const DISMISS_VELOCITY = 600
/* How far the pill travels when flicked away. */
const LEAVE_DISTANCE = 80

export function ToastHost() {
  const toast = useActiveToast()
  if (!toast) return null
  return <ToastPill key={toast.id} toast={toast} />
}

function ToastPill({ toast }: { toast: ActiveToast }) {
  const { hide } = useToast()
  const { pause, resume } = useToastTimer()
  const insets = useSafeAreaInsets()
  const tabBarHeight = useTabBarHeight()
  const clearance = useToastClearance()
  const atBottom = toast.placement === 'bottom'
  const shift = useSharedValue(0)
  const fade = useSharedValue(1)

  /* Only movement towards the edge the pill hangs on counts: up for the
     top, down for the bottom. */
  const towardsEdge = (translation: number) => {
    'worklet'
    return atBottom ? Math.max(0, translation) : Math.min(0, translation)
  }

  const pan = Gesture.Pan()
    .activeOffsetY(atBottom ? [-1000, 8] : [-8, 1000])
    .onStart(() => {
      scheduleOnRN(pause)
    })
    .onUpdate((event) => {
      shift.value = towardsEdge(event.translationY)
    })
    .onEnd((event) => {
      const distance = Math.abs(towardsEdge(event.translationY))
      const speed = atBottom ? event.velocityY : -event.velocityY
      if (distance > DISMISS_DISTANCE || speed > DISMISS_VELOCITY) {
        shift.value = withTiming(atBottom ? LEAVE_DISTANCE : -LEAVE_DISTANCE, { duration: DURATIONS.fast, reduceMotion: ReduceMotion.System })
        fade.value = withTiming(0, { duration: DURATIONS.fast, reduceMotion: ReduceMotion.System }, () => {
          'worklet'
          scheduleOnRN(hide)
        })
      } else {
        shift.value = withSpring(0, SPRINGS.gentle)
        scheduleOnRN(resume)
      }
    })

  const motion = useAnimatedStyle(() => ({ transform: [{ translateY: shift.value }], opacity: fade.value }))

  const Glyph = toneIcon[toast.tone]
  /* Above the tab bar, the screen's bottom chrome and a breath. */
  const position = atBottom ? { bottom: (tabBarHeight || insets.bottom) + space.lg + clearance + space.md } : { top: insets.top + space.md }
  const entering = (atBottom ? FadeInUp : FadeInDown).springify().damping(20).reduceMotion(ReduceMotion.System)

  return (
    <View pointerEvents="box-none" style={[styles.layer, position]}>
      <GestureDetector gesture={pan}>
        <Animated.View entering={entering} exiting={atBottom ? leaveDown() : leaveUp()} style={motion}>
          {/* A tap dismisses; a long press only holds the timer, so the
              no-op long press keeps the release from counting as a tap. */}
          <PressableScale
            onPress={hide}
            onLongPress={() => undefined}
            onPressIn={pause}
            onPressOut={resume}
            scaleTo={0.985}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={[styles.pill, { borderColor: toneBorder[toast.tone] }]}
          >
            <Glyph size={iconSize.md} weight="fill" color={toneInk[toast.tone]} />
            <Text variant="small" weight="semibold" style={styles.text}>
              {toast.text}
            </Text>
            {toast.action ? (
              <PressableScale
                pressedFill="transparent"
                ripple={false}
                onPress={() => {
                  hide()
                  toast.action?.onPress()
                }}
                hitSlop={8}
                style={styles.action}
              >
                <Text variant="small" weight="bold" tone="accent">
                  {toast.action.label}
                </Text>
              </PressableScale>
            ) : null}
          </PressableScale>
        </Animated.View>
      </GestureDetector>
    </View>
  )
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    maxWidth: '100%',
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    backgroundColor: colors.surface,
  },
  text: {
    flexShrink: 1,
  },
  action: {
    paddingLeft: space.xs,
  },
})
