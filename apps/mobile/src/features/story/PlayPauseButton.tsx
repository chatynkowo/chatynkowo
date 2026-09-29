import { useEffect } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { DURATIONS, IconButton, PauseIcon, PlayIcon, ReduceMotion, colors, iconSize } from '../../ui'

/* The player's transport: one control whose play and pause glyphs trade
   places with a crossfade (the one leaving shrinks a little as it fades).
   A loading recording shows a spinner instead and does not react. */

type PlayPauseButtonProps = {
  playing: boolean
  busy?: boolean
  /* The accessible name, which changes with the state. */
  label: string
  onPress: () => void
  disabled?: boolean
}

const LEAVING_SCALE = 0.7

export function PlayPauseButton({ playing, busy = false, label, onPress, disabled }: PlayPauseButtonProps) {
  /* 0 shows play, 1 shows pause. */
  const state = useSharedValue(playing ? 1 : 0)

  useEffect(() => {
    state.value = withTiming(playing ? 1 : 0, { duration: DURATIONS.fast, reduceMotion: ReduceMotion.System })
  }, [playing, state])

  const playStyle = useAnimatedStyle(() => ({
    opacity: 1 - state.value,
    transform: [{ scale: 1 - state.value * (1 - LEAVING_SCALE) }],
  }))
  const pauseStyle = useAnimatedStyle(() => ({
    opacity: state.value,
    transform: [{ scale: LEAVING_SCALE + state.value * (1 - LEAVING_SCALE) }],
  }))

  return (
    <IconButton label={label} onPress={onPress} disabled={disabled || busy} accessibilityState={{ disabled: Boolean(disabled || busy), busy }}>
      {busy ? (
        <ActivityIndicator color={colors.accentStrong} />
      ) : (
        <View style={styles.glyphs}>
          <Animated.View style={[styles.glyph, playStyle]}>
            <PlayIcon size={iconSize.lg} weight="fill" color={colors.accentStrong} />
          </Animated.View>
          <Animated.View style={[styles.glyph, pauseStyle]}>
            <PauseIcon size={iconSize.lg} weight="fill" color={colors.accentStrong} />
          </Animated.View>
        </View>
      )}
    </IconButton>
  )
}

const styles = StyleSheet.create({
  glyphs: {
    width: iconSize.lg,
    height: iconSize.lg,
  },
  glyph: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
})
