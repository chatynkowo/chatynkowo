import { useImperativeHandle, useRef, type ComponentRef, type Ref } from 'react'
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native'
import { BottomSheetTextInput } from '@gorhom/bottom-sheet'
import { Text } from './Text'
import { colors, fonts, radius, sizes, space, typeScale } from './tokens'

/* A labelled single-line input in the app's type — the nickname sheet's
   field today, forms of later features tomorrow. The handle focuses the
   field, for a sheet that focuses it once it has settled. */

/* The field, for the screen to focus. */
export type TextFieldHandle = { focus: () => void }

export type TextFieldProps = TextInputProps & {
  label: string
  hint?: string
  /* The field sits in a SheetRoute: it becomes the sheet's own input, so
     the rising keyboard extends the sheet instead of covering the field. */
  sheet?: boolean
  ref?: Ref<TextFieldHandle>
}

export function TextField({ label, hint, sheet = false, style, ref, ...rest }: TextFieldProps) {
  /* The two inputs type their refs differently; whichever is mounted is
     the one focused. */
  const plain = useRef<TextInput>(null)
  const inSheet = useRef<ComponentRef<typeof BottomSheetTextInput>>(undefined)
  useImperativeHandle(ref, () => ({ focus: () => (sheet ? inSheet.current : plain.current)?.focus() }), [sheet])
  const shared = {
    accessibilityLabel: label,
    placeholderTextColor: colors.inkFaint,
    selectionColor: colors.accent,
    style: [styles.input, style],
    ...rest,
  }
  return (
    <View style={styles.field}>
      <Text variant="small" tone="soft" weight="semibold">
        {label}
      </Text>
      {sheet ? <BottomSheetTextInput ref={inSheet} {...shared} /> : <TextInput ref={plain} {...shared} />}
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
