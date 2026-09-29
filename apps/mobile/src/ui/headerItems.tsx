import { Platform, StyleSheet, View } from 'react-native'
import type { NativeStackHeaderItem, NativeStackNavigationOptions } from 'expo-router'
import { IconButton } from './Button'
import { HEADER_SYMBOLS } from './icons'
import { colors, iconSize, space } from './tokens'

/* Right-side buttons of a native header. iOS gets real bar button items with
   SF Symbols (unstable_headerRightItems); Android, whose native stack does
   not draw those, gets the same actions as IconButtons with the Phosphor
   glyphs through headerRight. Screens describe the buttons once and spread
   the result into their Stack.Screen options. */

export type HeaderItemRole = keyof typeof HEADER_SYMBOLS

export type HeaderItemSpec = {
  role: HeaderItemRole
  /* The accessible name; also the label the bar shows when it has no icon. */
  label: string
  onPress: () => void
  disabled?: boolean
}

function iosItem({ role, label, onPress, disabled }: HeaderItemSpec): NativeStackHeaderItem {
  return {
    type: 'button',
    label,
    icon: { type: 'sfSymbol', name: HEADER_SYMBOLS[role].sf },
    tintColor: colors.ink,
    onPress,
    disabled,
  }
}

function AndroidItems({ items }: { items: HeaderItemSpec[] }) {
  return (
    <View style={styles.row}>
      {items.map(({ role, label, onPress, disabled }) => {
        const Glyph = HEADER_SYMBOLS[role].Glyph
        return (
          <IconButton key={role} label={label} onPress={onPress} disabled={disabled} style={styles.barButton}>
            <Glyph size={iconSize.lg} color={colors.ink} />
          </IconButton>
        )
      })}
    </View>
  )
}

export function headerRightItems(items: HeaderItemSpec[]): Pick<NativeStackNavigationOptions, 'unstable_headerRightItems' | 'headerRight'> {
  if (Platform.OS === 'ios') {
    return { unstable_headerRightItems: () => items.map(iosItem) }
  }
  return { headerRight: () => <AndroidItems items={items} /> }
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  /* Bar buttons are bare glyphs: no surface, no border, as Material draws
     its app bar actions. */
  barButton: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
})
