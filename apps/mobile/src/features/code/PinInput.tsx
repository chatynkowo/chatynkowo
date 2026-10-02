import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type ComponentRef } from 'react'
import { Keyboard, Pressable, StyleSheet, useWindowDimensions } from 'react-native'
import Animated, { cancelAnimation, interpolateColor, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import { BottomSheetTextInput } from '@gorhom/bottom-sheet'
import { DURATIONS, ReduceMotion, SPRINGS, Text, colors, radius, space, useReducedMotion } from '../../ui'
import type { CodePhase } from './useCodeEntry'
import { SHAKE_MS, useShake } from './useShake'

/* Four digit boxes drawn over one hidden input, so the numeric keyboard,
   paste and one-time-code autofill all work as on a plain field while the
   boxes look like the site's pin input. The input is the code sheet's own
   (a rising keyboard then extends the sheet) and sits as a point in the
   row's corner, so nothing it types can show beside the boxes; a tap
   anywhere on the row focuses it, which takes the focus back however the
   keyboard was put away. The input is the one control for assistive tech;
   the boxes are decoration. Each digit bumps its box, a check pulses the
   row, an error shakes it red, an accepted code fills it gold. */

type PinInputProps = {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  phase: CodePhase
}

/* The field, for the screen to focus once its sheet has settled. */
export type PinInputHandle = { focus: () => void }

const LENGTH = 4
const MAX_BOX_WIDTH = 60
const BOX_RATIO = 1.2
const BUMP_MS = 90
const TONE_MS = 200
const PULSE_HALF_MS = 700
const PULSE_LOW = 0.6
const PULSE_STATIC = 0.8

/* The border and fill follow one value: 0 at rest, 1 in error, 2 accepted. */
const PHASE_TONE: Record<CodePhase, number> = { idle: 0, checking: 0, waiting: 0, error: 1, success: 2 }

export const PinInput = forwardRef<PinInputHandle, PinInputProps>(function PinInput({ value, onChange, onSubmit, phase }, ref) {
  const { t } = useTranslation()
  const { width: windowWidth } = useWindowDimensions()
  const input = useRef<ComponentRef<typeof BottomSheetTextInput>>(undefined)
  const [focused, setFocused] = useState(false)
  /* Android keeps the input focused when the keyboard is hidden with Back,
     so the active box follows the keyboard itself. */
  const [keyboardShown, setKeyboardShown] = useState(false)
  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', () => setKeyboardShown(true))
    const hidden = Keyboard.addListener('keyboardDidHide', () => setKeyboardShown(false))
    return () => {
      shown.remove()
      hidden.remove()
    }
  }, [])
  const { style: shakeStyle, shake } = useShake()

  const boxWidth = Math.min(MAX_BOX_WIDTH, Math.floor((windowWidth - 2 * space.lg - (LENGTH - 1) * space.md) / LENGTH))
  const activeIndex = Math.min(value.length, LENGTH - 1)

  const focus = useCallback(() => input.current?.focus(), [])
  useImperativeHandle(ref, () => ({ focus }), [focus])

  /* The error shakes the row and hands the focus back once the boxes clear. */
  useEffect(() => {
    if (phase !== 'error') return
    shake()
    const timer = setTimeout(focus, SHAKE_MS)
    return () => clearTimeout(timer)
  }, [phase, shake, focus])

  /* Done with fewer digits only puts the keyboard away. */
  const submitIfComplete = () => {
    if (value.length === LENGTH) onSubmit()
  }

  return (
    <Pressable style={styles.wrap} onPress={() => input.current?.focus()} accessible={false}>
      <Animated.View style={[styles.boxes, shakeStyle]} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {Array.from({ length: LENGTH }, (_, index) => (
          <PinBox key={index} digit={value[index] ?? ''} active={focused && keyboardShown && index === activeIndex} phase={phase} width={boxWidth} />
        ))}
      </Animated.View>
      <BottomSheetTextInput
        ref={input}
        value={value}
        onChangeText={onChange}
        onSubmitEditing={submitIfComplete}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={LENGTH}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        returnKeyType="done"
        caretHidden
        selectionColor="transparent"
        accessibilityLabel={t('mobile:code.inputAria')}
        style={styles.input}
      />
    </Pressable>
  )
})

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
      <Text variant="digit" adjustsFontSizeToFit numberOfLines={1}>
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
  /* A point in the row's corner, drawing nothing: a zero opacity would
     also hide it from the screen reader. */
  input: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 1,
    height: 1,
    color: 'transparent',
    backgroundColor: 'transparent',
  },
})
