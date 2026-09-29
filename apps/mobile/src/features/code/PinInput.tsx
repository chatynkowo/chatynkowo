import { useCallback, useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native'
import Animated, { cancelAnimation, interpolateColor, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated'
import { useFocusEffect } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { haptic } from '../../lib/haptics'
import { DURATIONS, ReduceMotion, SPRINGS, Text, colors, fonts, radius, space, useReducedMotion } from '../../ui'
import type { CodePhase } from './useCodeEntry'
import { SHAKE_MS, useShake } from './useShake'

/* Four digit boxes over one invisible input, so the numeric keyboard, paste
   and one-time-code autofill all work as on a plain field while the boxes
   look like the site's pin input. The boxes are decoration for assistive
   tech; the input is the one control. Each digit bumps its box, a check
   pulses the row, an error shakes it red, an accepted code fills it gold. */

type PinInputProps = {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  phase: CodePhase
  /* Focus the input (and raise the keyboard) whenever the route is focused. */
  autoFocus?: boolean
}

const LENGTH = 4
const MAX_BOX_WIDTH = 60
const BOX_RATIO = 1.2
/* A beat after the sheet appears, so the keyboard rises with it settled. */
const FOCUS_DELAY_MS = 80
const BUMP_MS = 90
const TONE_MS = 200
const PULSE_HALF_MS = 700
const PULSE_LOW = 0.6
const PULSE_STATIC = 0.8

/* The border and fill follow one value: 0 at rest, 1 in error, 2 accepted. */
const PHASE_TONE: Record<CodePhase, number> = { idle: 0, checking: 0, waiting: 0, error: 1, success: 2 }

export function PinInput({ value, onChange, onSubmit, phase, autoFocus = false }: PinInputProps) {
  const { t } = useTranslation()
  const { width: windowWidth } = useWindowDimensions()
  const input = useRef<TextInput>(null)
  const [focused, setFocused] = useState(false)
  const { style: shakeStyle, shake } = useShake()

  const boxWidth = Math.min(MAX_BOX_WIDTH, Math.floor((windowWidth - 2 * space.lg - (LENGTH - 1) * space.md) / LENGTH))
  const activeIndex = Math.min(value.length, LENGTH - 1)

  const focus = useCallback(() => input.current?.focus(), [])

  useFocusEffect(
    useCallback(() => {
      if (!autoFocus) return
      const timer = setTimeout(focus, FOCUS_DELAY_MS)
      return () => clearTimeout(timer)
    }, [autoFocus, focus]),
  )

  /* A digit added ticks; removed or cleared digits are silent. */
  const previousLength = useRef(value.length)
  useEffect(() => {
    if (value.length > previousLength.current) haptic('select')
    previousLength.current = value.length
  }, [value])

  /* The error shakes the row and hands the focus back once the boxes clear. */
  useEffect(() => {
    if (phase !== 'error') return
    shake()
    const timer = setTimeout(focus, SHAKE_MS)
    return () => clearTimeout(timer)
  }, [phase, shake, focus])

  return (
    <View style={styles.wrap}>
      <Pressable accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden onPress={focus}>
        <Animated.View style={[styles.boxes, shakeStyle]}>
          {Array.from({ length: LENGTH }, (_, index) => (
            <PinBox key={index} digit={value[index] ?? ''} active={focused && index === activeIndex} phase={phase} width={boxWidth} />
          ))}
        </Animated.View>
      </Pressable>
      <TextInput
        ref={input}
        value={value}
        onChangeText={onChange}
        onSubmitEditing={onSubmit}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        editable
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={LENGTH}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        returnKeyType="done"
        caretHidden
        accessibilityLabel={t('mobile:code.pasteAria')}
        style={styles.hidden}
      />
    </View>
  )
}

function PinBox({ digit, active, phase, width }: { digit: string; active: boolean; phase: CodePhase; width: number }) {
  const reduceMotion = useReducedMotion()
  const scale = useSharedValue(1)
  const tone = useSharedValue(PHASE_TONE[phase])
  const opacity = useSharedValue(1)
  const restBorder = active ? colors.accentStrong : colors.lineStrong

  useEffect(() => {
    if (!digit) return
    scale.value = withSequence(withTiming(1.08, { duration: BUMP_MS, reduceMotion: ReduceMotion.System }), withSpring(1, SPRINGS.gentle))
  }, [digit, scale])

  useEffect(() => {
    tone.value = withTiming(PHASE_TONE[phase], { duration: TONE_MS, reduceMotion: ReduceMotion.System })
  }, [phase, tone])

  useEffect(() => {
    const busy = phase === 'checking' || phase === 'waiting'
    cancelAnimation(opacity)
    if (!busy) {
      opacity.value = withTiming(1, { duration: DURATIONS.fast, reduceMotion: ReduceMotion.System })
      return
    }
    if (reduceMotion) {
      opacity.value = PULSE_STATIC
      return
    }
    opacity.value = withRepeat(
      withSequence(
        withTiming(PULSE_LOW, { duration: PULSE_HALF_MS, reduceMotion: ReduceMotion.System }),
        withTiming(1, { duration: PULSE_HALF_MS, reduceMotion: ReduceMotion.System }),
      ),
      -1,
      false,
    )
  }, [phase, reduceMotion, opacity])

  const motion = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
    borderColor: interpolateColor(tone.value, [0, 1, 2], [restBorder, colors.danger, colors.accentStrong]),
    backgroundColor: interpolateColor(tone.value, [0, 1, 2], [colors.surface, colors.surface, colors.accentWash]),
  }))

  return (
    <Animated.View style={[styles.box, { width, height: Math.round(width * BOX_RATIO) }, motion]}>
      <Text variant="display" style={styles.digit} adjustsFontSizeToFit numberOfLines={1}>
        {digit}
      </Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
  },
  boxes: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: space.md,
  },
  box: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radius.control,
  },
  digit: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 36,
  },
  hidden: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
})
