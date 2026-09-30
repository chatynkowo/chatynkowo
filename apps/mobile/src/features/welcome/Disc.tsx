import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { colors } from '../../ui'

/* The gold-ringed disc the welcome screens set their glyphs in: the four
   questions' icons and the trail's footprints, so the two pages share one
   mark. Decorative, so hidden from the screen reader; the row around it
   carries the words. The trail also needs the size for its path. */
export const DISC = 48

export function Disc({ children }: { children: ReactNode }) {
  return (
    <View style={styles.disc} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  disc: {
    width: DISC,
    height: DISC,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.accentBorder,
    borderRadius: DISC / 2,
    backgroundColor: colors.surface,
  },
})
