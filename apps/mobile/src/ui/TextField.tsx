import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native'
import { Text } from './Text'
import { colors, fonts, radius, sizes, space, typeScale } from './tokens'

/* A labelled single-line input in the app's type — the profile's nickname
   field today, forms of later features tomorrow. */

export type TextFieldProps = TextInputProps & {
  label: string
  hint?: string
}

export function TextField({ label, hint, style, ...rest }: TextFieldProps) {
  return (
    <View style={styles.field}>
      <Text variant="small" tone="soft" weight="semibold">
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.inkFaint}
        selectionColor={colors.accent}
        style={[styles.input, style]}
        {...rest}
      />
      {hint ? (
        <Text variant="small" tone="faint">
          {hint}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  field: {
    gap: space.xs,
  },
  input: {
    ...typeScale.body,
    minHeight: sizes.button,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.control,
    backgroundColor: colors.surface,
    color: colors.ink,
    fontFamily: fonts.body,
  },
})
