import { useRef, useState } from 'react'
import { Pressable, StyleSheet, TextInput, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Text, colors, fonts, radius, space } from '../../ui'

/* Four digit boxes over one invisible input, so the numeric keyboard, paste
   and one-time-code autofill all work as on a plain field while the boxes
   look like the site's pin input. */

type PinInputProps = {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  disabled?: boolean
  invalid?: boolean
}

const LENGTH = 4

export function PinInput({ value, onChange, onSubmit, disabled, invalid }: PinInputProps) {
  const { t } = useTranslation()
  const input = useRef<TextInput>(null)
  const [focused, setFocused] = useState(false)
  const activeIndex = Math.min(value.length, LENGTH - 1)

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="none"
        accessibilityLabel={t('quest.codeLabel')}
        style={styles.boxes}
        onPress={() => input.current?.focus()}
        disabled={disabled}
      >
        {Array.from({ length: LENGTH }, (_, index) => {
          const digit = value[index] ?? ''
          const active = focused && index === activeIndex
          return (
            <View
              key={index}
              accessible
              accessibilityLabel={t('quest.digitAria', { index: index + 1 })}
              accessibilityValue={{ text: digit }}
              style={[styles.box, active && styles.boxActive, invalid && styles.boxInvalid]}
            >
              <Text variant="display" style={styles.digit}>
                {digit}
              </Text>
            </View>
          )
        })}
      </Pressable>
      <TextInput
        ref={input}
        value={value}
        onChangeText={onChange}
        onSubmitEditing={onSubmit}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        editable={!disabled}
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
    width: 60,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.control,
    backgroundColor: colors.surface,
  },
  boxActive: {
    borderColor: colors.accentStrong,
    backgroundColor: colors.accentWash,
  },
  boxInvalid: {
    borderColor: colors.danger,
  },
  digit: {
    fontFamily: fonts.displayBlack,
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
